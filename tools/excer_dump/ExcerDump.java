import android.app.UiAutomation;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import com.android.uiautomator.core.UiAutomationShellWrapper;
import java.io.FileOutputStream;

/**
 * excer-bot 화면 읽기. uiautomator dump 와 같은 모양의 XML 을 쓴다.
 * uiautomator dump 는 화면이 1초 동안 멈춰야 읽는데(바쁜 대화방에서는 끝내 못 읽음),
 * 이것은 잠깐만 기다리고 그대로 읽는다.
 * 실행: CLASSPATH=/system/framework/uiautomator.jar:/data/local/tmp/excer_dump.jar
 *       app_process /system/bin ExcerDump 파일 [조용히 기다릴 ms] [최대 ms] [화면 폭] [화면 높이]
 */
public class ExcerDump {
    public static void main(String[] args) throws Exception {
        String out = args.length > 0 ? args[0] : "/data/local/tmp/excer_ui.xml";
        long quiet = args.length > 1 ? Long.parseLong(args[1]) : 200;
        long max = args.length > 2 ? Long.parseLong(args[2]) : 1200;
        int w = args.length > 3 ? Integer.parseInt(args[3]) : 0;
        int h = args.length > 4 ? Integer.parseInt(args[4]) : 0;
        UiAutomationShellWrapper wrap = new UiAutomationShellWrapper();
        wrap.connect();
        wrap.setCompressedLayoutHierarchy(false);   // uiautomator dump 와 같게 덜 중요한 칸까지 모두
        try {
            UiAutomation ua = wrap.getUiAutomation();
            try {
                ua.waitForIdle(quiet, max);
            } catch (Exception e) {
                // 바빠서 멈추지 않아도 그대로 읽는다
            }
            AccessibilityNodeInfo root = null;
            for (int i = 0; i < 20 && root == null; i++) {
                root = ua.getRootInActiveWindow();
                if (root == null) Thread.sleep(100);
            }
            StringBuilder sb = new StringBuilder();
            sb.append("<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation=\"0\">");
            if (root != null) node(root, sb, 0, w, h);
            sb.append("</hierarchy>");
            FileOutputStream f = new FileOutputStream(out);
            f.write(sb.toString().getBytes("UTF-8"));
            f.close();
            System.out.println(root == null ? "no-root" : "ok");
        } finally {
            wrap.disconnect();
        }
    }

    static void node(AccessibilityNodeInfo n, StringBuilder sb, int index, int w, int h) {
        Rect r = new Rect();
        n.getBoundsInScreen(r);
        int l = r.left, t = r.top, rr = r.right, b = r.bottom;
        if (w > 0) { l = Math.max(0, Math.min(l, w)); rr = Math.max(0, Math.min(rr, w)); }
        if (h > 0) { t = Math.max(0, Math.min(t, h)); b = Math.max(0, Math.min(b, h)); }
        sb.append("<node index=\"").append(index).append('"');
        attr(sb, "text", n.getText());
        attr(sb, "resource-id", n.getViewIdResourceName());
        attr(sb, "class", n.getClassName());
        attr(sb, "package", n.getPackageName());
        attr(sb, "content-desc", n.getContentDescription());
        sb.append(" clickable=\"").append(n.isClickable()).append('"');
        sb.append(" long-clickable=\"").append(n.isLongClickable()).append('"');
        sb.append(" bounds=\"[").append(l).append(',').append(t).append("][").append(rr).append(',').append(b).append("]\">");
        int c = n.getChildCount();
        for (int i = 0; i < c; i++) {
            AccessibilityNodeInfo k = null;
            try {
                k = n.getChild(i);
            } catch (Exception e) {
                k = null;   // 읽는 사이에 바뀐 칸은 건너뛴다
            }
            if (k != null && k.isVisibleToUser()) node(k, sb, i, w, h);
        }
        sb.append("</node>");
    }

    static void attr(StringBuilder sb, String name, CharSequence v) {
        sb.append(' ').append(name).append("=\"");
        if (v != null) {
            String s = v.toString();
            for (int i = 0; i < s.length(); i++) {
                char ch = s.charAt(i);
                if (ch == '&') sb.append("&amp;");
                else if (ch == '<') sb.append("&lt;");
                else if (ch == '>') sb.append("&gt;");
                else if (ch == '"') sb.append("&quot;");
                else if (ch == '\n') sb.append("&#10;");
                else if (ch == '\r') sb.append("&#13;");
                else if (ch == '\t') sb.append("&#9;");
                else if (ch >= 0x20) sb.append(ch);
            }
        }
        sb.append('"');
    }
}
