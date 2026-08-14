package app.mimensajero.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        enableWebViewMediaPermissions();
    }

    // Allow getUserMedia (camera + mic) inside the WebView
    private void enableWebViewMediaPermissions() {
        WebView webView = getBridge().getWebView();
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                request.grant(request.getResources());
            }
        });
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);

            NotificationChannel messages = new NotificationChannel(
                "messages", "Mensajes", NotificationManager.IMPORTANCE_HIGH
            );
            messages.setDescription("Notificaciones de mensajes");
            messages.enableVibration(true);
            nm.createNotificationChannel(messages);

            NotificationChannel calls = new NotificationChannel(
                "calls", "Llamadas", NotificationManager.IMPORTANCE_HIGH
            );
            calls.setDescription("Notificaciones de llamadas entrantes");
            calls.enableVibration(true);
            nm.createNotificationChannel(calls);
        }
    }
}
