function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === "security_alert") {
      const result = handleSecurityAlert(data);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }
    const STRIPE_SECRET_KEY =
  PropertiesService.getScriptProperties()
    .getProperty("STRIPE_SECRET_KEY");

　　const name = encodeURIComponent(String(data.productName || "商品"));
    const price = Math.floor(Number(data.price));

    var payload = "payment_method_types[0]=card"
      + "&line_items[0][price_data][currency]=jpy"
      + "&line_items[0][price_data][product_data][name]=" + name
      + "&line_items[0][price_data][unit_amount]=" + price
      + "&line_items[0][quantity]=1"
      + "&mode=payment"
      + "&shipping_address_collection[allowed_countries][0]=JP"
      + "&phone_number_collection[enabled]=true"
      + "&success_url=" + encodeURIComponent("https://tomatonoso.github.io/homepage99/?success=true")
      + "&cancel_url=" + encodeURIComponent("https://tomatonoso.github.io/homepage99/");

    if (data.sellerAccountId) {
      payload += "&payment_intent_data[application_fee_amount]=" + Math.floor(price * 0.10)
              + "&payment_intent_data[transfer_data][destination]=" + data.sellerAccountId;
    }

    const options = {
      method: "post",
      headers: {
        "Authorization": "Bearer " + STRIPE_SECRET_KEY,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      payload: payload,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch("https://api.stripe.com/v1/checkout/sessions", options);
    const json = JSON.parse(response.getContentText());

    // JSON形式で url を返却
    return ContentService.createTextOutput(JSON.stringify({
      url: json.url,
      error: json.error ? json.error.message : null
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
function handleSecurityAlert(data) {
  try {
    const props = PropertiesService.getScriptProperties();
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const threshold = 3;

    const deviceId = String(data.deviceId || "unknown").slice(0, 200);
    const key = "SECURITY_ATTEMPTS_" + Utilities.base64EncodeWebSafe(
      Utilities.computeDigest(
        Utilities.DigestAlgorithm.SHA_256,
        deviceId
      )
    ).slice(0, 80);

    const stored = JSON.parse(props.getProperty(key) || "[]");
    const recent = stored.filter(function(timestamp) {
      return now - Number(timestamp) < windowMs;
    });

    recent.push(now);
    props.setProperty(key, JSON.stringify(recent));

    if (recent.length >= threshold) {
      const lastNotified = Number(
        props.getProperty(key + "_NOTIFIED") || 0
      );

      if (now - lastNotified >= windowMs) {
        const notifyTo = props.getProperty("SECURITY_ALERT_EMAIL") || Session.getEffectiveUser().getEmail();

        if (notifyTo) {
          MailApp.sendEmail({
            to: notifyTo,
            subject: "【ミナトモ！】管理者エリアへの繰り返しアクセス試行",
            body:
              "管理者専用エリアへの未登録端末からのアクセス試行を検知しました。\n\n" +
              "短時間に複数回のアクセス試行が確認されています。\n" +
              "アクセス試行回数: " + recent.length + "回\n" +
              "検知時刻: " + new Date(now).toISOString() + "\n\n" +
              "この通知はGAS側で自動送信されています。"
          });

          props.setProperty(key + "_NOTIFIED", String(now));
        }
      }
    }

    return {
      ok: true,
      attempts: recent.length
    };
  } catch (error) {
    console.error("Security alert error:", error);
    return {
      ok: false
    };
  }
}
