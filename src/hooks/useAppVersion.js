import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CURRENT_VERSION = '1.0.0'

export function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(false)
  const [newVersion, setNewVersion] = useState(null)
  const [changelog, setChangelog] = useState('')

  useEffect(() => {
    checkVersion()
  }, [])

  async function checkVersion() {
    const { data } = await supabase
      .from('app_versions')
      .select('version, force_update, changelog')
      .eq('is_current', true)
      .single()

    if (!data) return
    if (data.version !== CURRENT_VERSION) {
      setUpdateAvailable(true)
      setForceUpdate(data.force_update)
      setNewVersion(data.version)
      setChangelog(data.changelog)
    }
  }

  return { updateAvailable, forceUpdate, newVersion, changelog }
}
