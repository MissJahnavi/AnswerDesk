import redisClient from "./src/redis.js";

try {
    await redisClient.set("answerdesk:test", "Redis Cloud connected");
    const result = await redisClient.get("answerdesk:test");

    console.log("Redis test result:", result);
} catch (error) {
    console.error("Redis test failed:", error.message);
} finally {
    await redisClient.quit();
}
