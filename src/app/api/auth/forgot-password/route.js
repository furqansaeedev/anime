import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { getAppUrl } from "@/lib/app-url";

// Brevo SMTP Configuration
const smtpPort = Number(process.env.BREVO_SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_SMTP_HOST,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      );
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const resetUrl = new URL("/reset-password", getAppUrl());
    resetUrl.searchParams.set("token", token);

    await transporter.sendMail({
      from: `"${process.env.BREVO_FROM_NAME || "AIME Support"}" <${process.env.BREVO_FROM_EMAIL}>`,
      to: user.email,
      subject: "Reset Your AIME Password",
      html: `
        <div style="background-color: #0B0D19; color: #F5F2E9; padding: 20px; font-family: sans-serif; border-radius: 8px;">
          <h2 style="color: #C9A44C;">AIME Password Reset</h2>
          <p>You requested to reset your password. Click the button below to set a new one:</p>
          <a href="${resetUrl.toString()}" style="background-color: #C9A44C; color: #0B0D19; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 20px 0;">
            Reset Password
          </a>
          <p style="font-size: 12px; color: #A3A6B5;">This link expires in 1 hour. If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: "Password reset link sent to your email!",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}