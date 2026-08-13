package app.easydunya;

import android.content.Intent;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private SwipeRefreshLayout swipeRefreshLayout;
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
        setupPullToRefresh();
        if (pendingNotificationUrl != null) {
            openNotificationUrl(pendingNotificationUrl);
            pendingNotificationUrl = null;
        }
    }

    private void setupPullToRefresh() {
        if (swipeRefreshLayout != null || getBridge() == null) return;

        WebView webView = getBridge().getWebView();
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent == null) return;

        int index = parent.indexOfChild(webView);
        parent.removeView(webView);

        swipeRefreshLayout = new SwipeRefreshLayout(this);
        swipeRefreshLayout.setColorSchemeColors(0xFF1976D2, 0xFFF97316);
        swipeRefreshLayout.addView(
            webView,
            new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        parent.addView(swipeRefreshLayout, index);

        swipeRefreshLayout.setOnRefreshListener(() -> {
            webView.reload();
            swipeRefreshLayout.setRefreshing(false);
        });
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
