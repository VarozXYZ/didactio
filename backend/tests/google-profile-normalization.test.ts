import {describe, expect, it} from "vitest";
import type {Profile} from "passport-google-oauth20";
import {normalizeGoogleProfile} from "../src/auth/passport/google.js";

describe("normalizeGoogleProfile", () => {
	it("maps the standard google oauth payload fields correctly", () => {
		const profile = {
			provider: "google",
			id: "",
			displayName: "",
			name: {},
			emails: [],
			photos: [],
			_json: {
				user: {
					id: "116807551237969746774",
					email: "123456@gmail.com",
					verified_email: true,
					name: "John Doe",
					given_name: "John",
					family_name: "Doe",
					picture:
						"https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252ldubv5M/photo.jpg",
					locale: "en",
				},
			},
		} as unknown as Profile;

		expect(normalizeGoogleProfile(profile)).toEqual({
			provider: "google",
			providerUserId: "116807551237969746774",
			email: "123456@gmail.com",
			emailVerified: true,
			displayName: "John Doe",
			firstName: "John",
			lastName: "Doe",
			pictureUrl:
				"https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252ldubv5M/photo.jpg",
			locale: "en",
		});
	});

	it("prefers passport normalized fields when available", () => {
		const profile = {
			provider: "google",
			id: "passport-id",
			displayName: "Passport Name",
			name: {
				givenName: "Passport",
				familyName: "User",
			},
			emails: [{value: "passport@example.com"}],
			photos: [{value: "https://example.com/passport-avatar.png"}],
			_json: {
				email: "raw@example.com",
				email_verified: true,
				name: "Raw Name",
				given_name: "Raw",
				family_name: "User",
				picture: "https://example.com/raw-avatar.png",
				locale: "en",
			},
		} as unknown as Profile;

		expect(normalizeGoogleProfile(profile)).toEqual({
			provider: "google",
			providerUserId: "passport-id",
			email: "passport@example.com",
			emailVerified: true,
			displayName: "Passport Name",
			firstName: "Passport",
			lastName: "User",
			pictureUrl: "https://example.com/passport-avatar.png",
			locale: "en",
		});
	});

	it("falls back to id_token claims when profile data is sparse", () => {
		const payload = Buffer.from(
			JSON.stringify({
				sub: "116807551237969746774",
				email: "123456@gmail.com",
				email_verified: true,
				name: "John Doe",
				given_name: "John",
				family_name: "Doe",
				picture:
					"https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252ldubv5M/photo.jpg",
				locale: "en",
			}),
		).toString("base64url");

		const profile = {
			provider: "google",
			id: "",
			displayName: "",
			name: {},
			emails: [],
			photos: [],
			_json: {
				credentials: {
					id_token: `header.${payload}.signature`,
				},
			},
		} as unknown as Profile;

		expect(normalizeGoogleProfile(profile)).toEqual({
			provider: "google",
			providerUserId: "116807551237969746774",
			email: "123456@gmail.com",
			emailVerified: true,
			displayName: "John Doe",
			firstName: "John",
			lastName: "Doe",
			pictureUrl:
				"https://lh3.googleusercontent.com/-XdUIqdMkCWA/AAAAAAAAAAI/AAAAAAAAAAA/4252ldubv5M/photo.jpg",
			locale: "en",
		});
	});
});
