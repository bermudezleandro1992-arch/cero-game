import { PushNotifications } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'

export async function initPushNotifications(userId, onCallReceived) {
  if (!Capacitor.isNativePlatform()) return null

  // Request permission
  const perm = await PushNotifications.requestPermissions()
  if (perm.receive !== 'granted') return null

  // Register with FCM
  await PushNotifications.register()

  // Get FCM token and save to Supabase
  PushNotifications.addListener('registration', async (token) => {
    console.log('FCM token:', token.value)
    // Save token to user's profile so others can send them notifications
    const { supabase } = await import('./supabase')
    await supabase.from('users')
      .update({ fcm_token: token.value })
      .eq('id', userId)
  })

  PushNotifications.addListener('registrationError', (err) => {
    console.error('FCM registration error:', err)
  })

  // Handle notifications when app is open
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

  // Handle tap on notification when app is in background/closed
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
