מצטער על העיכוב, אני מבין שבלוק הקוד הקודם פשוט לא הופיע אצלך. אני אכתוב את הקוד כאן בטקסט פשוט, בלי התיבה המיוחדת, כדי שתראה אותו בבירור.

תעתיק את כל הטקסט שמתחת לקו, ותחליף איתו את כל התוכן בקובץ src/components/SocialAuthButtons.tsx:

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const SocialAuthButtons = () => {
const handleGoogleLogin = async () => {
const { error } = await supabase.auth.signInWithOAuth({
provider: 'google',
options: {
redirectTo: ${window.location.origin}/,
},
});

};

const handleAppleLogin = async () => {
const { error } = await supabase.auth.signInWithOAuth({
provider: 'apple',
options: {
redirectTo: ${window.location.origin}/,
},
});

};

return (
<div className="space-y-3">
<div className="relative flex items-center gap-3 py-2">
<div className="h-px flex-1 bg-border" />
<span className="text-xs text-muted-foreground">או התחברו עם</span>
<div className="h-px flex-1 bg-border" />
</div>

);
};

export default SocialAuthButtons;
