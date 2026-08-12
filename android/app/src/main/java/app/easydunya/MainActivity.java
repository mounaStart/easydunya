package app.easydunya;

import android.view.ViewGroup;
import android.webkit.WebView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private SwipeRefreshLayout swipeRefreshLayout;

    @Override
    public void onStart() {
        super.onStart();
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
}
