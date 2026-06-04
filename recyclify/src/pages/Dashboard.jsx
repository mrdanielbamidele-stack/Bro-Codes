import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import BarcodeIcon from '../components/svgs/BarcodeIcon'
import TrophyIcon from '../components/svgs/TrophyIcon'
import GlobeIcon from '../components/svgs/GlobeIcon'
import BottleIcon from '../components/svgs/BottleIcon'
import CanIcon from '../components/svgs/CanIcon'
import BoxIcon from '../components/svgs/BoxIcon'

const POINTS_PER_SCAN = 3

const MAT_ICON = {
  Plastic: <BottleIcon size={20} color="var(--mint)" />,
  Metal: <CanIcon size={20} color="var(--mint)" />,
  Paper: <BoxIcon size={20} color="var(--mint)" />,
  Can: <CanIcon size={20} color="var(--mint)" />,
  Carton: <BoxIcon size={20} color="var(--mint)" />,
}

export default function Dashboard({ session, profile, onRefreshProfile, showToast }) {
  const [scans, setScans] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  // status: 'idle' | 'analysing' | 'ready' | 'no-barcode' | 'no-bin' | 'error'
  const [snapState, setSnapState] = useState({ status: 'idle', message: '' })
  const [detected, setDetected] = useState(null)
  const [confirming, setConfirming] = useState(false)

  const fileInputRef = useRef(null)

  /* ---- fetch user's scans ---- */
  const fetchScans = useCallback(async () => {
    if (!session) return
    const { data } = await supabase
      .from('scans')
      .select('*')
      .eq('user_id', session.user.id)
      .order('scanned_at', { ascending: false })
      .limit(50)
    if (data) setScans(data)
  }, [session])

  /* ---- fetch leaderboard ---- */
  const fetchLeaderboard = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('name, points, scan_count')
      .order('points', { ascending: false })
      .limit(10)
    if (data) setLeaderboard(data)
  }, [])

  useEffect(() => {
    fetchScans()
    fetchLeaderboard()

    const channel = supabase
      .channel('leaderboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchLeaderboard()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [fetchScans, fetchLeaderboard])

  /* ---- snap / upload handler ---- */
  async function handleSnap(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setDetected(null)
    setSnapState({ status: 'analysing', message: 'Analysing photo…' })

    const imageBase64 = await new Promise((resolve, reject) => {
      const fr = new FileReader()
      fr.onload = () => resolve(fr.result.split(',')[1])
      fr.onerror = reject
      fr.readAsDataURL(file)
    })
    const mediaType = file.type || 'image/jpeg'

    try {
      const { data, error } = await supabase.functions.invoke('check-waste-bin', {
        body: { imageBase64, mediaType },
      })
      if (error) throw error

      const { barcode, hasWasteBin, description } = data

      if (!barcode) {
        setSnapState({ status: 'no-barcode', message: 'No barcode number found. Retake — make sure the digits under the barcode are clear.' })
        return
      }

      if (!hasWasteBin) {
        setDetected({ barcode, type: 'Plastic' })
        setSnapState({ status: 'no-bin', message: `Barcode found (#${barcode}) but no waste bin visible. ${description}` })
        return
      }

      setDetected({ barcode, type: 'Plastic' })
      setSnapState({ status: 'ready', message: `Barcode #${barcode} — ${description}` })
    } catch (err) {
      setSnapState({ status: 'error', message: 'Something went wrong. Try again.' })
    }

    e.target.value = ''
  }

  /* ---- confirm scan → Supabase ---- */
  async function confirmScan() {
    if (!detected || confirming || snapState.status !== 'ready') return
    setConfirming(true)

    try {
      const { error } = await supabase.rpc('award_scan_points', {
        p_user_id: session.user.id,
        p_barcode: detected.barcode,
        p_points: POINTS_PER_SCAN,
      })

      if (error) {
        if (error.code === '23505') {
          setSnapState({ status: 'error', message: `Barcode #${detected.barcode} was already claimed by someone else!` })
          showToast({ title: 'Already claimed!', message: 'Someone beat you to it. Find another.', type: 'error' })
        } else {
          throw error
        }
      } else {
        setSnapState({ status: 'idle', message: '' })
        showToast({ title: '+3 points earned!', message: `Barcode #${detected.barcode} claimed.`, type: 'success' })
        await Promise.all([fetchScans(), onRefreshProfile(), fetchLeaderboard()])
        setDetected(null)
      }
    } catch (err) {
      setSnapState({ status: 'error', message: 'Error saving scan: ' + err.message })
    } finally {
      setConfirming(false)
    }
  }

  const myRank = leaderboard.findIndex(r => r.name === profile?.name) + 1
  const co2 = (profile?.scan_count || 0) * 82

  const statusCls = {
    analysing: 'work',
    ready: 'ok',
    'no-barcode': 'err',
    'no-bin': 'err',
    error: 'err',
  }[snapState.status] ?? ''

  const confirmLabel = confirming
    ? 'Claiming…'
    : snapState.status === 'analysing'
    ? 'Analysing…'
    : snapState.status === 'no-bin'
    ? 'Bin required in photo'
    : 'Confirm & earn +3 pts'

  return (
    <div className="dash">
      {/* ---- balance bar ---- */}
      <div className="card panel" style={{ marginBottom: 22 }}>
        <div className="balance">
          <div>
            <div className="ph-sub" style={{ marginBottom: 6 }}>
              Your green balance,{' '}
              <span style={{ color: 'var(--lime)' }}>
                {profile?.name?.split(' ')[0] || 'Recycler'}
              </span>
            </div>
            <div className="big">
              <span>{profile?.points ?? 0}</span>{' '}
              <small>pts</small>
            </div>
          </div>
          <div className="balance-meta">
            <div>
              <b>{profile?.scan_count ?? 0}</b>
              <span>items claimed</span>
            </div>
            <div>
              <b>{co2 >= 1000 ? (co2 / 1000).toFixed(1) + 'kg' : co2 + 'g'}</b>
              <span>CO₂ saved</span>
            </div>
            <div>
              <b>#{myRank || '—'}</b>
              <span>leaderboard</span>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-grid">
        {/* ---- scanner panel ---- */}
        <div className="card panel">
          <h3>Snap &amp; claim</h3>
          <p className="ph-sub">
            Take a photo of a littered item showing the barcode digits and a nearby waste bin.
            The AI reads the number and checks for a bin — first to claim wins the points.
          </p>

          {/* big snap button */}
          <button
            className="btn btn-primary"
            style={{ width: '100%', padding: '18px 0', fontSize: 17, marginTop: 8, letterSpacing: 0.3 }}
            onClick={() => {
              setDetected(null)
              setSnapState({ status: 'idle', message: '' })
              fileInputRef.current?.click()
            }}
            disabled={snapState.status === 'analysing'}
          >
            <svg
              width="20" height="20"
              viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ marginRight: 10, verticalAlign: 'middle' }}
              aria-hidden="true"
            >
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            {snapState.status === 'analysing' ? 'Analysing…' : 'Snap photo'}
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleSnap}
          />

          <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
            Make sure the digits under the barcode and a bin are both visible
          </p>

          {/* status message */}
          {snapState.message && (
            <div className="scan-status" style={{ marginTop: 14 }}>
              <span className={statusCls}>{snapState.message}</span>
            </div>
          )}

          {/* confirm card — only shown after AI approves both */}
          {detected && (
            <div className="detected" style={{ marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <BarcodeIcon size={18} color="var(--lime)" />
                <span className="barcode-num">#{detected.barcode}</span>
              </div>
              <span className="chip-mat">
                {MAT_ICON[detected.type] || <BottleIcon size={14} color="var(--mint)" />}
                {' '}{detected.type}
              </span>
              {snapState.status === 'no-bin' && (
                <p style={{ color: 'var(--err, #ff6b6b)', fontSize: 13, marginTop: 8, marginBottom: 0 }}>
                  Retake with a waste bin clearly visible to claim points.
                </p>
              )}
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 14 }}
                onClick={confirmScan}
                disabled={confirming || snapState.status !== 'ready'}
              >
                {confirmLabel}
              </button>
            </div>
          )}
        </div>

        {/* ---- recent scans feed ---- */}
        <div className="card panel">
          <h3>Your claimed barcodes</h3>
          <p className="ph-sub">Every barcode you've successfully claimed.</p>
          <div className="feed">
            {scans.length === 0 ? (
              <div className="empty">
                <BarcodeIcon size={36} color="var(--line-strong)" />
                <p style={{ marginTop: 12 }}>No scans yet — snap a photo to claim!</p>
              </div>
            ) : (
              scans.map(s => (
                <div className="scan-item" key={s.id}>
                  <div className="ic">
                    {MAT_ICON[s.material] || <BottleIcon size={20} color="var(--mint)" />}
                  </div>
                  <div className="meta">
                    <b>#{s.barcode}</b>
                    <small>{new Date(s.scanned_at).toLocaleString()}</small>
                  </div>
                  <div className="gain">+{s.points_awarded}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---- extras: leaderboard + impact ---- */}
      <div className="extra-grid">
        <div className="card panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrophyIcon size={18} color="var(--lime)" />
            Leaderboard
          </h3>
          <p className="ph-sub">Top scanners on campus — updated live.</p>
          {leaderboard.length === 0 ? (
            <div className="empty">
              <TrophyIcon size={32} color="var(--line-strong)" />
              <p style={{ marginTop: 10 }}>Be the first to scan!</p>
            </div>
          ) : (
            leaderboard.map((r, i) => {
              const isMe = r.name === profile?.name
              return (
                <div className={`lb-row ${isMe ? 'you' : ''}`} key={r.name + i}>
                  <div className="lb-rank">{i + 1}</div>
                  <div style={{ flex: 1 }}><b>{r.name}{isMe ? ' (you)' : ''}</b></div>
                  <div className="mono" style={{ color: 'var(--lime)' }}>{r.points} pts</div>
                </div>
              )
            })
          )}
        </div>

        <div className="card panel">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GlobeIcon size={18} color="var(--lime)" />
            Your impact
          </h3>
          <p className="ph-sub">Estimated environmental savings from your scans.</p>
          <div className="impact-stat">
            <span>Items diverted from campus</span>
            <b>{profile?.scan_count ?? 0}</b>
          </div>
          <div className="impact-stat">
            <span>CO₂ emissions saved</span>
            <b>{co2 >= 1000 ? (co2 / 1000).toFixed(1) + ' kg' : co2 + ' g'}</b>
          </div>
          <div className="impact-stat">
            <span>Energy saved</span>
            <b>{(profile?.scan_count ?? 0) * 55} Wh</b>
          </div>
          <div className="impact-stat">
            <span>Total points earned</span>
            <b>{profile?.points ?? 0}</b>
          </div>
        </div>
      </div>
    </div>
  )
}
