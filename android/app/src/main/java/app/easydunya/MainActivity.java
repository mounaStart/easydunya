package app.easydunya;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private String pendingNotificationUrl;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EasyDunyaLocationPlugin.class);
        super.onCreate(savedInstanceState);
        pendingNotificationUrl = extractNotificationUrl(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        String url = extractNotificationUrl(intent);
        if (url != null) {
            pendingNotificationUrl = url;
            openNotificationUrl(url);
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (pendingNotificationUrl != null) {
            openNotificationUrl(pendingNotificationUrl);
            pendingNotificationUrl = null;
        }
    }

    private static String extractNotificationUrl(Intent intent) {
        if (intent == null) return null;
        String url = intent.getStringExtra("url");
        if (url == null || url.trim().isEmpty()) return null;
        String path = url.trim();
        return path.startsWith("/") ? path : "/" + path;
    }

    private void openNotificationUrl(String path) {
        if (getBridge() == null || getBridge().getWebView() == null) {
            pendingNotificationUrl = path;
            return;
        }
        final String js = "window.location.assign(" + JSONObject.quote(path) + ");";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }
}
