export function buildPrivacyPolicyPage(): string {
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>سياسة الخصوصية — البيت الشامي</title>
    <meta name="description" content="سياسة الخصوصية لتطبيق البيت الشامي" />
    <style>
      :root {
        color-scheme: dark;
        font-family: Arial, Tahoma, sans-serif;
        background: #0f0a05;
        color: #f7efe6;
      }
      body { margin: 0; background: #0f0a05; }
      main { max-width: 760px; margin: 0 auto; padding: 32px 20px 56px; }
      header, section {
        background: #1a1008;
        border: 1px solid #3a2818;
        border-radius: 18px;
        padding: 22px;
        margin-bottom: 14px;
      }
      header { text-align: center; }
      h1 { color: #e8920c; margin: 0 0 8px; font-size: 28px; }
      h2 { color: #e8920c; font-size: 19px; margin: 0 0 10px; }
      p, li { line-height: 1.9; font-size: 16px; }
      ul { padding-right: 22px; }
      .updated { color: #d9b98e; font-size: 14px; }
      .english { direction: ltr; text-align: left; margin-top: 28px; }
      a { color: #f1b84b; }
      footer { color: #b9a18a; text-align: center; font-size: 13px; padding-top: 12px; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>سياسة الخصوصية</h1>
        <div>البيت الشامي</div>
        <div class="updated">آخر تحديث: أغسطس 2026</div>
      </header>

      <section>
        <h2>البيانات التي نجمعها</h2>
        <p>قد نجمع الاسم ورقم الهاتف والعنوان وبيانات الطلب اللازمة لتقديم خدمات البيت الشامي. لا نطلب بيانات لا نحتاجها لتشغيل الخدمة.</p>
      </section>
      <section>
        <h2>استخدام البيانات</h2>
        <p>نستخدم البيانات لمعالجة الطلبات والتوصيل والتواصل معك بشأن طلبك وتحسين تجربة التطبيق. لا نبيع بياناتك ولا نستخدمها لأغراض إعلانية غير مرتبطة بالخدمة.</p>
      </section>
      <section>
        <h2>بيانات الموقع والإشعارات</h2>
        <p>يتم استخدام الموقع فقط عندما تختار تحديد عنوان التوصيل، أو عندما يوافق المندوب على مشاركة موقعه أثناء تنفيذ طلب توصيل نشط. قد نستخدم رمز الإشعارات لإرسال تحديثات الطلب والعروض المتعلقة بالخدمة.</p>
      </section>
      <section>
        <h2>الحماية والاحتفاظ</h2>
        <p>نحمي البيانات عبر اتصال مشفّر ونحتفظ بها للمدة اللازمة لتقديم الخدمة والالتزام بالمتطلبات النظامية. الوصول إليها مقيّد بالمصرح لهم.</p>
      </section>
      <section>
        <h2>حقوقك وحذف الحساب</h2>
        <p>يمكنك طلب الوصول إلى بياناتك أو تصحيحها أو حذفها. يمكنك حذف حسابك من داخل تطبيق البيت الشامي عبر قسم الحساب، كما يمكنك سحب أذونات الموقع والإشعارات من إعدادات جهازك.</p>
      </section>
      <section>
        <h2>التواصل</h2>
        <p>لأي استفسار متعلق بالخصوصية أو البيانات، استخدم قنوات الدعم الموجودة داخل تطبيق البيت الشامي.</p>
      </section>

      <section class="english" lang="en" dir="ltr">
        <h2>Privacy Policy</h2>
        <p>The Levantine House may collect your name, phone number, delivery address, order details, location when you request address detection or when an active delivery is in progress, and notification identifiers needed to provide service updates.</p>
        <p>We use this information to process orders, arrange delivery, communicate about orders, and improve the service. We do not sell personal data or use it for unrelated advertising.</p>
        <p>We protect data through encrypted connections, restrict access to authorized staff, and retain it only as long as needed to provide the service and meet legal requirements.</p>
        <p>You can request access to, correction of, or deletion of your data. You can delete your account from the account section inside the app and revoke device permissions through your device settings.</p>
        <p>For privacy or data questions, use the support channels available inside The Levantine House app.</p>
      </section>

      <footer>البيت الشامي — جميع الحقوق محفوظة © 2026</footer>
    </main>
  </body>
</html>`;
}