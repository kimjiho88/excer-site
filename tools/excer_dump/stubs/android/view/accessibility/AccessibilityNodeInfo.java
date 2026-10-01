package android.view.accessibility;
public class AccessibilityNodeInfo {
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
}
