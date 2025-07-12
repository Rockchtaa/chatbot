import nodemailer, { Transporter } from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  senderEmail: string;
  senderName: string;
  verificationBaseUrl: string;
}

const getConfig = (): EmailConfig => {
  const getEnvVar = (key: string, defaultValue?: string): string => {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is not defined. Please check your .env file.`);
    }
    return value;
  };

  return {
    host: getEnvVar('EMAIL_HOST'),
    port: parseInt(getEnvVar('EMAIL_PORT', '587'), 10),
    user: getEnvVar('BREVO_SMTP_USER'),
    pass: getEnvVar('EMAIL_PASS'),
    senderEmail: getEnvVar('SENDER_EMAIL', 'ebryassine@gmail.com'),
    senderName: getEnvVar('SENDER_NAME', 'rockchta'),
    verificationBaseUrl: getEnvVar('VERIFICATION_BASE_URL', 'http://localhost:8000'), // Ensure this matches your frontend
  };
};

const emailConfig = getConfig();

const transporter: Transporter = nodemailer.createTransport({
  host: emailConfig.host,
  port: emailConfig.port,
  secure: emailConfig.port === 465, 
  debug: process.env.NODE_ENV !== 'production', // Enable debug only in non-production environments
  auth: {
    user: emailConfig.user,
    pass: emailConfig.pass,
  },
});

/**
 * Sends a verification email to the specified user.
 * @param userEmail 
 * @param userName 
 * @param token 
 * @returns 
 * @throws 
 */
export const sendVerificationEmail = async (userEmail: string, userName: string, token: string): Promise<void> => {
  const verificationUrl = `${emailConfig.verificationBaseUrl}/verify-email?token=${token}`;

  const mailOptions = {
    from: `"${emailConfig.senderName}" <${emailConfig.senderEmail}>`,
    to: userEmail,
    subject: 'Action Required: Verify Your Chatbot Account Email',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f9f9f9; padding: 20px; border-radius: 10px; max-width: 600px; margin: 20px auto; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee;">
          <h1 style="color: #0056b3; margin: 0; font-size: 28px;">Welcome to Your Chatbot!</h1>
        </div>
        <div style="padding: 20px 0;">
          <p style="font-size: 17px;">Hello **${userName}**,</p>
          <p style="font-size: 16px;">
            Thank you for creating an account with Your Chatbot. To complete your registration and activate your account, please verify your email address by clicking the button below:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #28a745; color: white; padding: 15px 30px; text-align: center; text-decoration: none; display: inline-block; border-radius: 8px; font-size: 18px; font-weight: bold;">
              Verify My Email
            </a>
          </div>
          <p style="font-size: 15px; color: #555;">
            This link is valid for a limited time. If you didn't create an account, please disregard this email.
          </p>
        </div>
        <div style="text-align: center; padding-top: 20px; border-top: 1px solid #eee; font-size: 13px; color: #777;">
          <p>Best regards,</p>
          <p>**The Your Chatbot Team**</p>
          <p style="margin-top: 10px;">&copy; ${new Date().getFullYear()} Your Chatbot Service. All rights reserved.</p>
        </div>
      </div>
    `,
  };

  try {
    console.log(`Attempting to send verification email to ${userEmail}...`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`Verification email successfully sent to ${userEmail}. Message ID: ${info.messageId}`);
  } catch (error) {
    console.error(`Failed to send verification email to ${userEmail}:`, error);
    throw new Error(`Error sending verification email: ${(error as Error).message}`);
  }
};