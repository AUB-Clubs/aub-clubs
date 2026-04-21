# Supabase Configuration Guide

This document outlines the required Supabase dashboard configuration for the AUB Clubs authentication system.

## Email Verification Redirect URLs

The application handles email verification callbacks on multiple routes. Configure the following redirect URLs in your Supabase dashboard:

### Development
```
http://localhost:3000
http://localhost:3000/auth
```

### Production
```
https://yourdomain.com
https://yourdomain.com/auth
```

## Configuration Steps

1. **Navigate to Supabase Dashboard**
   - Go to your project settings
   - Click on "Authentication" in the sidebar

2. **Email Settings**
   - Enable "Email" provider
   - Enable "Confirm email" option
   - Set minimum password length to 8

3. **URL Configuration**
   - Go to "URL Configuration" section
   - Add redirect URLs listed above to "Redirect URLs" field
   - Site URL should be your primary domain (e.g., `http://localhost:3000` or `https://yourdomain.com`)

4. **JWT Settings**
   - Set JWT expiry to `1209600` seconds (2 weeks)

5. **Storage Configuration**
   - Ensure "uploads" bucket exists
   - Set bucket to public
   - Configure RLS policies to allow authenticated users to upload to their own folder
   - For server-side Inngest uploads (event poster generation), set a service-role key in server env (`SUPABASE_SERVICE_ROLE_KEY` preferred; aliases supported: `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_SERVICE_ROLE`) so background jobs can upload regardless of end-user session state

## How Email Verification Works

1. User signs up with email and password
2. Supabase sends verification email with a magic link
3. User clicks the link in their email
4. Supabase redirects to your configured URL with hash parameters:
   ```
   https://yourdomain.com/#access_token=xxx&type=signup&...
   ```
5. `AuthCallbackHandler` component detects the callback:
   - Exchanges token for session
   - Marks email as verified in database
   - Redirects to `/onboarding`
6. User completes onboarding and gains access to the platform

## Troubleshooting

**Issue:** Email verification link goes to landing page and doesn't redirect

**Solution:** 
- Check that `AuthCallbackHandler` is included in both `LandingPage.tsx` and `auth-view.tsx`
- Verify redirect URLs are configured correctly in Supabase dashboard
- Ensure the URLs match exactly (including trailing slashes if any)

**Issue:** Email verification link shows "Invalid link"

**Solution:**
- Check JWT expiry settings
- Verify email confirmation is enabled in Supabase
- Ensure user hasn't already verified their email

**Issue:** Callback handler not working

**Solution:**
- Check browser console for errors
- Verify Supabase environment variables are set correctly
- Ensure `markEmailVerified` tRPC mutation is working
