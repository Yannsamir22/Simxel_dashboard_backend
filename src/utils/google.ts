import { OAuth2Client } from "google-auth-library";

const getClient = () => {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if(!clientId) throw new Error("GOOGLE_CLIENT_ID is not set in environment variables.");
      return new OAuth2Client(clientId);
}

export interface GoogleUserInfo{
      googleId: string;
      email: string;
      name: string;
      picture?: string;
}

/**
 * Verifies a Google ID token and returns the decoded user info.
 * Throws if the token is invalid or the audience doesn't match
 */
export const verifyGoogleToken = async (idToken: string): Promise<GoogleUserInfo> => {
      const client = getClient();
      const clientId = process.env.GOOGLE_CLIENT_ID!;

      const ticket = await client.verifyIdToken({
            idToken,
            audience: clientId,
      })

      const payload = ticket.getPayload();
      if(!payload) throw new Error("Google token payload is empty.");

      const {sub, email, name, picture} = payload;

      if(!email) throw new Error("Google account has no email address.")
            
            return{
                  googleId: sub,
                  email,
                  name: name || email.split("@")[0],
                  picture: picture || undefined
            }
}