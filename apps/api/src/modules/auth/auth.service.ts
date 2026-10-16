import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { DatabaseError } from "pg";

import { pool } from "../../config/database.js";
import type { RegisterInput, LoginInput } from "./auth.schema.js";

export async function registerUser(input: RegisterInput) {
    const {
        firstName,
        lastName,
        email,
        password,
        role,
    } = input;

    try {
        const existingUser = await pool.query(
            `
                SELECT id
                FROM users
                WHERE LOWER(email) = LOWER($1)
            `,
            [email]
        );

        if (existingUser.rowCount) {
            throw new Error("EMAIL_ALREADY_EXISTS");
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const result = await pool.query(
            `
                INSERT INTO users (
                    first_name,
                    last_name,
                    email,
                    password_hash,
                    role
                )
                VALUES ($1, $2, $3, $4, $5)
                RETURNING
                    id,
                    first_name,
                    last_name,
                    email,
                    role,
                    created_at
            `,
            [
                firstName,
                lastName,
                email,
                passwordHash,
                role,
            ]
        );

        const user = result.rows[0];
        return { id: user.id, firstName: user.first_name, lastName: user.last_name,
            email: user.email, role: user.role, createdAt: user.created_at };
    } catch (error) {
        const databaseError = error as DatabaseError;

        if (
            databaseError.code === "23505" &&
            ["users_email_key", "idx_users_email_lower_unique"].includes(databaseError.constraint ?? "")
        ) {
            throw new Error("EMAIL_ALREADY_EXISTS");
        }

        throw error;
    }
}

export async function loginUser(input: LoginInput) {
    const { email, password } = input;

    const result = await pool.query(
        `
            SELECT
                id,
                first_name,
                last_name,
                email,
                password_hash,
                role,
                created_at
            FROM users
            WHERE LOWER(email) = LOWER($1)
        `,
        [email]
    );

    const user = result.rows[0];

    if (!user) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatches) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const jwtSecret = process.env.JWT_ACCESS_SECRET;

    if (!jwtSecret) {
        throw new Error("JWT_ACCESS_SECRET is not defined");
    }

    const accessToken = jwt.sign(
        {
            sub: user.id,
            role: user.role,
        },
        jwtSecret,
        {
            expiresIn: "15m",
        }
    );

    return {
        accessToken,
        user: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            role: user.role,
            createdAt: user.created_at,
        },
    };
}

export async function getCurrentUser(userId: string) {
    const result = await pool.query(
        `
            SELECT
                id,
                first_name,
                last_name,
                email,
                role,
                created_at
            FROM users
            WHERE id = $1
        `,
        [userId]
    );

    const user = result.rows[0];

    if (!user) {
        throw new Error("USER_NOT_FOUND");
    }

    return {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
    };
}