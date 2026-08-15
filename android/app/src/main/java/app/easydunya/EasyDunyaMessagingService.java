package app.easydunya;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Affiche les notifications FCM avec le logo Easy Dunya :
 * fond blanc + couleurs bleu/orange (grande icône), silhouette bleue en barre d'état.
 */
public class EasyDunyaMessagingService extends FirebaseMessagingService {

    private static final String CHANNEL_ID = "easydunya_default";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        PushNotificationsPlugin.sendRemoteMessage(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        String title = firstNonEmpty(
            data.get("title"),
            remoteMessage.getNotification() != null ? remoteMessage.getNotification().getTitle() : null,
            "Easy Dunya"
        );
        String body = firstNonEmpty(
            data.get("body"),
            remoteMessage.getNotification() != null ? remoteMessage.getNotification().getBody() : null,
            ""
        );

        showNotification(title, body, data);
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        PushNotificationsPlugin.onNewToken(token);
    }

    private void showNotification(String title, String body, Map<String, String> data) {
        ensureChannel();

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }

        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            (data.get("tag") != null ? data.get("tag") : title).hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Bitmap largeIcon = BitmapFactory.decodeResource(getResources(), R.drawable.ic_notify_large);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_notify)
            .setLargeIcon(largeIcon)
            .setColor(ContextCompat.getColor(this, R.color.notification_color))
            .setContentTitle(title)
            .setContentText(body)
            .setSubText("Easy Dunya")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE);

        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            int notificationId = data.get("tag") != null ? data.get("tag").hashCode() : title.hashCode();
            manager.notify(notificationId, builder.build());
        }
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager =
            (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Easy Dunya",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Réservations, confirmations et départs");
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    private static String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }
}
