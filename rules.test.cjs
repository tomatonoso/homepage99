const {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} = require("@firebase/rules-unit-testing");

const fs = require("fs");

async function main() {
  const env = await initializeTestEnvironment({
    projectId: "yauwo-a9ba1",
    database: {
      rules: fs.readFileSync("database.rules.json", "utf8"),
    host: "127.0.0.1",
    port: 9000,
    },
  });

  try {
    const userA = env
      .authenticatedContext("user-a")
      .database();

    const userB = env
      .authenticatedContext("user-b")
      .database();

    const admin = env
      .authenticatedContext("admin-test", {
        admin: true,
      })
      .database();

    console.log("=== 商品・購入・注文・チャット セキュリティテスト ===");

    // 1. 商品は一般ユーザーが読み取り可能
    await assertSucceeds(
      userA.ref("/products/product-001").once("value")
    );
    console.log("PASS: 商品の一般ユーザー読み取り");

    // 2. 一般ユーザーによる商品書き込み拒否
    await assertFails(
      userA.ref("/products/product-001").set({
        sellerUid: "user-a",
      })
    );
    console.log("PASS: 一般ユーザーの商品書き込み拒否");

    // 3. 管理者による商品書き込み
    await assertSucceeds(
      admin.ref("/products/product-001").set({
        sellerUid: "user-a",
        title: "テスト商品",
      })
    );
    console.log("PASS: 管理者の商品書き込み");

    // 4. 購入リクエストを本人が作成
    await assertSucceeds(
      userA.ref("/purchase_requests/request-001").set({
        requesterUid: "user-a",
        sellerUid: "user-b",
      })
    );
    console.log("PASS: 購入リクエスト本人作成");

    // 5. 他人の購入リクエスト読み取り拒否
    await assertFails(
      userB.ref("/purchase_requests/request-002").once("value")
    );
    console.log("PASS: 他人の購入リクエスト読み取り拒否");

    // 6. 注文データを他人が読み取れない
   await admin.ref("/orders/order-001").set({
  buyerUid: "user-a",
  sellerUid: "user-b",
  paymentStatus: "pending",
});
    await assertFails(
      env
        .authenticatedContext("user-c")
        .database()
        .ref("/orders/order-001")
        .once("value")
    );
    console.log("PASS: 第三者の注文読み取り拒否");

    // 7. チャット参加者のみ読み取り可能
   await userA.ref("/chat_rooms/room-001/members/user-a").set(true);

    await assertSucceeds(
      userA.ref("/chat_rooms/room-001").once("value")
    );
    console.log("PASS: チャット参加者の読み取り");

    // 8. チャット非参加者の読み取り拒否
    const userC = env
      .authenticatedContext("user-c")
      .database();

    await assertFails(
      userC.ref("/chat_rooms/room-001").once("value")
    );
    console.log("PASS: チャット非参加者の読み取り拒否");

    // 9. メッセージ送信者UIDの偽装拒否
    await assertFails(
      userA.ref("/chat_rooms/room-001/messages/msg-001").set({
        senderUid: "user-b",
        text: "UID偽装テスト",
      })
    );
    console.log("PASS: チャットsenderUid偽装拒否");

    // 10. 正しいsenderUidなら送信可能
    await assertSucceeds(
      userA.ref("/chat_rooms/room-001/messages/msg-002").set({
        senderUid: "user-a",
        text: "正常なメッセージ",
      })
    );
    console.log("PASS: 正しいsenderUidのメッセージ送信");

    console.log("");
    console.log("=== ALL TESTS PASSED ===");

  } finally {
    await env.cleanup();
  }
}

main().catch((error) => {
  console.error("");
  console.error("=== TEST FAILED ===");
  console.error(error);
  process.exit(1);
});