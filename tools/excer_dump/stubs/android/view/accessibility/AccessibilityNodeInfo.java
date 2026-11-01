package android.view.accessibility;
public class AccessibilityNodeInfo {
    public static final int ACTION_CLICK = 16;
    public static final int ACTION_LONG_CLICK = 32;
    public boolean performAction(int action) { return false; }
    public AccessibilityNodeInfo getParent() { return null; }
    public int getChildCount() { return 0; }
    public AccessibilityNodeInfo getChild(int i) { return null; }
    public CharSequence getText() { return null; }
    public CharSequence getContentDescription() { return null; }
    public String getViewIdResourceName() { return null; }
    public CharSequence getClassName() { return null; }
    public CharSequence getPackageName() { return null; }
    public boolean isClickable() { return false; }
    public boolean isLongClickable() { return false; }
    public boolean isVisibleToUser() { return false; }
    public void getBoundsInScreen(android.graphics.Rect r) {}
    public int getWindowId() { return 0; }
}
