import { useEffect, useState } from 'react'

const CURRENT_VERSION = '1.0.0'
const GITHUB_REPO = 'bermudezleandro1992-arch/cero-game'

export function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [newVersion, setNewVersion] = useState(null)
  const [changelog, setChangelog] = useState('')
  const [apkUrl, setApkUrl] = useState('')

  useEffect(() => {
    checkVersion()
  }, [])

  async function checkVersion() {
    try {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      if (!res.ok) return
      const data = await res.json()
      const latest = data.tag_name?.replace(/^v/, '')
      if (!latest || latest === CURRENT_VERSION) return
      const apk = data.assets?.find(a => a.name.endsWith('.apk'))
      setUpdateAvailable(true)
      setNewVersion(latest)
      setChangelog(data.body?.split('\n')[0] || '')
      setApkUrl(apk?.browser_download_url || '')
    } catch {}
  }

  return { updateAvailable, forceUpdate: false, newVersion, changelog, apkUrl }
}
