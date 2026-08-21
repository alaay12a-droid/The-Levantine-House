#!/bin/bash
# عنوان API الإنتاجي المعتمد للبيت الشامي موجود في eas.json.
# لا تستخدم أي نطاق Replit أو رابط مشروع قديم.

if [ -z "$1" ]; then
  echo "الاستخدام: bash set-production-url.sh https://the-levantine-house.onrender.com"
  exit 1
fi

NEW_URL="$1"
EAS_FILE="eas.json"

# Replace the placeholder with the actual URL
sed -i "s|REPLACE_WITH_DEPLOYED_URL|${NEW_URL}|g" "$EAS_FILE"

echo "✅ تم تحديث رابط الإنتاج في eas.json إلى: $NEW_URL"
echo "الخطوة التالية: eas build --platform android --profile production"
