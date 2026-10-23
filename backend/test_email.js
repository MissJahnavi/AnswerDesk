
import "dotenv/config";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: "live.smtp.mailtrap.io",
  port: 587,
  auth: {
    user: "api",
    pass: process.env.SMTP_PASS,
  },
  logger: true,
  debug: true,
});

try {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: process.env.SMTP_TEST_TO,
    subject: "AnswerDesk SMTP Test",
    text: "Testing AnswerDesk email delivery.",
  });

  console.log("Email sent successfully.");
} catch (error) {
  console.error("Email test failed:", error.code, error.message);
} finally {
  transporter.close();
}


// try {
//   const info = await transporter.sendMail({
//     from: process.env.SMTP_FROM,
//     to: "mjahnavi2311@gmail.com",
//     subject: "AnswerDesk SMTP Test",
//     text: "If you received this in Mailtrap, SMTP email delivery works.",
//   });

//   console.log("Email sent successfully:", info.messageId);
// } catch (error) {
//   console.error("Email test failed:", error.code, error.message);
// } finally {
//   transporter.close();
// }
