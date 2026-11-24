import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
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

const registerSchema = z.object({
  displayName: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .length(8, "Password must be exactly 8 characters")
    .regex(
      /[^a-zA-Z0-9]/,
      "Password must contain at least one special character (e.g. @, #, $, !)"
    ),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { displayName, email, password } = result.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Email is already registered" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        verificationToken,
        isVerified: false,
        profile: {
          create: { displayName },
        },
        settings: {
          create: {},
        },
      },
    });

    const verifyUrl = new URL(
      "/api/auth/verify-email",
      getAppUrl()
    );

    verifyUrl.searchParams.set("token", verificationToken);

    await transporter.sendMail({
      from: `"${process.env.BREVO_FROM_NAME || "AIME Support"}" <${process.env.BREVO_FROM_EMAIL}>`,
      to: email,
      subject: "Verify your AIME Account",
      html: `
        <div style="background-color: #0B0D19; color: #F5F2E9; padding: 20px; font-family: sans-serif; border-radius: 8px;">
          <h2 style="color: #C9A44C;">Welcome to AIME!</h2>
          <p>Please verify your email address to activate your account.</p>
          <a href="${verifyUrl.toString()}" style="background-color: #C9A44C; color: #0B0D19; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin: 20px 0;">
            Verify Email
          </a>
          <p style="font-size: 12px; color: #A3A6B5;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
      `,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Registered! Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration Error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}