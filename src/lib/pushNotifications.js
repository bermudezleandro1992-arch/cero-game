import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'

// ── VAPID public key for Web Push ─────────────────────────────────────────────
const VAPID_PUBLIC_KEY = 'BLCy9nx7ys67rMaCUt81qkazrY6RSfrczT2kOaxZ1_5jPGD_Wc0b6s5Cupl-sxsyOFrhj6iY4swj5o2zuxBiO8U'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// ── Native Android (Capacitor + FCM) ─────────────────────────────────────────
export async function initPushNotifications(userId, onCallReceived) {
  if (!Capacitor.isNativePlatform()) return null

  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') return null

  await PushNotifications.register()

  PushNotifications.addListener('registration', async (token) => {
    await supabase.from('users').update({ fcm_token: token.value }).eq('id', userId)
  })

  PushNotifications.addListener('registrationError', (err) => {
    console.error('FCM registration error:', err)
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    const data = notification.data
    if (data?.type === 'call') {
      onCallReceived?.({
        convId: data.convId,
        from: data.from,
        fromName: data.fromName,
        callType: data.callType,
        offer: data.offer ? JSON.parse(data.offer) : null,
      })
    }
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action.notification.data
    if (data?.type === 'call') {
      onCallReceived?.({
        convId: data.convId,
        from: data.from,
        fromName: data.fromName,
        callType: data.callType,
        offer: data.offer ? JSON.parse(data.offer) : null,
      })
    }
  })
}

// ── Web Push (PWA — Chrome, Edge, Firefox, Safari 16.4+) ─────────────────────
export async function initWebPush(userId) {
  if (Capacitor.isNativePlatform()) return // use FCM on native
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    if (existing) {
      await saveWebPushSubscription(userId, existing)
      return existing
    }

    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return null

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    await saveWebPushSubscription(userId, sub)
    return sub
  } catch (err) {
    console.warn('Web Push init failed:', err)
    return null
  }
}

async function saveWebPushSubscription(userId, sub) {
  const json = sub.toJSON()
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    endpoint: json.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint' })
}

export async function removeWebPushSubscription(userId) {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await supabase.from('push_subscriptions').delete()
        .eq('user_id', userId).eq('endpoint', sub.endpoint)
    }
  } catch {}
}

// Listen for notification clicks relayed from service worker
export function listenNotificationClicks(callback) {
  if (!('serviceWorker' in navigator)) return () => {}
  const handler = (e) => {
    if (e.data?.type === 'NOTIFICATION_CLICK') callback(e.data)
  }
  navigator.serviceWorker.addEventListener('message', handler)
  return () => navigator.serviceWorker.removeEventListener('message', handler)
}
