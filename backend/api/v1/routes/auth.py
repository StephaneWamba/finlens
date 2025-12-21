"""Authentication routes for user sign-up, login, and OAuth."""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field

from backend.config.database.supabase_client import get_supabase_client
from backend.core.auth.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])


# Request/Response Models
class SignUpRequest(BaseModel):
    """Sign-up request model"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., min_length=8,
                          description="User password (min 8 characters)")
    full_name: Optional[str] = Field(None, description="User's full name")


class SignInRequest(BaseModel):
    """Sign-in request model"""
    email: EmailStr = Field(..., description="User email address")
    password: str = Field(..., description="User password")


class AuthResponse(BaseModel):
    """Authentication response model"""
    access_token: str = Field(..., description="JWT access token")
    refresh_token: Optional[str] = Field(None, description="JWT refresh token")
    user: dict = Field(..., description="User information")
    expires_in: int = Field(
        3600, description="Token expiration time in seconds")


class RefreshTokenRequest(BaseModel):
    """Token refresh request model"""
    refresh_token: str = Field(..., description="Refresh token")


class OAuthCallbackRequest(BaseModel):
    """OAuth callback request model"""
    code: str = Field(...,
                      description="Authorization code from OAuth provider")
    state: Optional[str] = Field(
        None, description="OAuth state parameter for CSRF protection")


@router.post("/signup", response_model=AuthResponse)
async def signup(request: SignUpRequest):
    """Create a new user account with email and password."""
    try:
        supabase = get_supabase_client()

        # Sign up user with Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {
                    "full_name": request.full_name or ""
                }
            }
        })

        if not auth_response.user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create user account"
            )

        # Get tokens
        session = auth_response.session
        if not session:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to create session"
            )

        # Create or update user profile
        user_id = auth_response.user.id
        try:
            supabase.table("users").insert({
                "id": user_id,
                "email": request.email,
                "full_name": request.full_name,
                "created_at": "now()"
            }).execute()
        except Exception as e:
            logger.warning(
                f"Failed to create user profile (may already exist): {e}")

        return AuthResponse(
            access_token=session.access_token,
            refresh_token=session.refresh_token,
            user={
                "id": user_id,
                "email": request.email,
                "full_name": request.full_name,
            },
            expires_in=session.expires_in or 3600
        )

    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg.lower() or "already exists" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        logger.error(f"Sign-up error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user account"
        )


@router.post("/signin", response_model=AuthResponse)
async def signin(request: SignInRequest):
    """Sign in with email and password."""
    try:
        supabase = get_supabase_client()

        # Sign in user
        auth_response = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password
        })

        if not auth_response.user or not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password"
            )

        # Get user profile
        user_id = auth_response.user.id
        user_profile = supabase.table("users").select(
            "*").eq("id", user_id).execute()

        user_data = {
            "id": user_id,
            "email": auth_response.user.email,
            "full_name": auth_response.user.user_metadata.get("full_name"),
        }

        if user_profile.data:
            user_data.update(user_profile.data[0])

        return AuthResponse(
            access_token=auth_response.session.access_token,
            refresh_token=auth_response.session.refresh_token,
            user=user_data,
            expires_in=auth_response.session.expires_in or 3600
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Sign-in error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )


@router.get("/google")
async def google_oauth(redirect_to: Optional[str] = None):
    """Initiate Google OAuth flow through Supabase."""
    try:
        from backend.config.settings import settings
        from urllib.parse import quote

        # Validate Supabase configuration
        if not settings.SUPABASE_URL:
            logger.error("SUPABASE_URL is not configured")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Supabase is not configured. Please set SUPABASE_URL environment variable."
            )

        # Get Supabase client (this will validate SUPABASE_KEY)
        try:
            get_supabase_client()
        except ValueError as ve:
            logger.error(f"Supabase client initialization failed: {ve}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Supabase configuration error: {str(ve)}"
            )

        # Frontend callback URL - must be provided in production
        if not redirect_to:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="redirect_to parameter is required. Frontend must provide callback URL."
            )

        frontend_callback = redirect_to
        if not frontend_callback.startswith("http"):
            frontend_callback = f"https://{frontend_callback}"

        # Use Supabase's authorize endpoint with redirect_to parameter
        # This ensures proper state validation and redirect handling
        encoded_redirect = quote(frontend_callback, safe='')
        oauth_url = f"{settings.SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to={encoded_redirect}"

        logger.info(f"Redirecting to Supabase OAuth: {oauth_url}")
        return RedirectResponse(url=oauth_url)

    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Google OAuth initiation error: {e}", exc_info=True)

        if "not enabled" in error_msg.lower() or "unsupported provider" in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google OAuth provider is not enabled in Supabase. Please configure Google OAuth credentials in Supabase."
            )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate OAuth flow: {error_msg}"
        )


@router.post("/callback", response_model=AuthResponse)
async def oauth_callback(request: OAuthCallbackRequest):
    """Fallback OAuth callback endpoint."""
    try:
        from backend.config.settings import settings

        supabase = get_supabase_client()

        # Exchange code for session using Supabase
        # Based on OAuth2 standard and Supabase docs: use authorization_code grant type
        import httpx

        # Extract frontend callback URL from state parameter
        # State contains the frontend URL that was passed during OAuth initiation
        # Note: Supabase typically redirects directly to frontend with tokens in hash
        # This endpoint is a fallback for code/state flow
        from urllib.parse import unquote

        frontend_redirect = None
        if request.state:
            # State was URL-encoded, decode it
            frontend_redirect = unquote(request.state)

        # If no state, Supabase should use configured redirect URLs from dashboard
        # Fallback: use CORS_ORIGINS from settings (production frontend URL)
        if not frontend_redirect:
            # Extract frontend URL from CORS_ORIGINS (should be production domain)
            cors_origin = settings.CORS_ORIGINS
            if cors_origin and cors_origin != "*":
                frontend_redirect = f"{cors_origin}/auth/callback"
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Missing state parameter and CORS_ORIGINS not configured. Cannot determine frontend callback URL."
                )

        redirect_url = frontend_redirect

        # Supabase token endpoint - use standard OAuth2 authorization_code flow
        token_url = f"{settings.SUPABASE_URL}/auth/v1/token"

        async with httpx.AsyncClient() as client:
            # Try multiple approaches - Supabase might auto-detect grant type
            # Approach 1: Without grant_type (Supabase auto-detection)
            logger.info(
                "Attempting token exchange without grant_type (auto-detect)")
            token_data_no_grant = {
                "code": request.code,
                "redirect_to": redirect_url,
            }

            token_response = await client.post(
                token_url,
                data=token_data_no_grant,
                headers={
                    "apikey": settings.SUPABASE_KEY,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            )

            # Approach 2: With authorization_code grant type and redirect_uri
            if token_response.status_code != 200:
                logger.info(
                    "Trying with grant_type=authorization_code and redirect_uri")
                token_data = {
                    "grant_type": "authorization_code",
                    "code": request.code,
                    "redirect_uri": redirect_url,
                }

                token_response = await client.post(
                    token_url,
                    data=token_data,
                    headers={
                        "apikey": settings.SUPABASE_KEY,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                )

            # Approach 3: With authorization_code and redirect_to
            if token_response.status_code != 200:
                logger.info(
                    "Trying with grant_type=authorization_code and redirect_to")
                token_data_alt = {
                    "grant_type": "authorization_code",
                    "code": request.code,
                    "redirect_to": redirect_url,
                }

                token_response = await client.post(
                    token_url,
                    data=token_data_alt,
                    headers={
                        "apikey": settings.SUPABASE_KEY,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                )

            if token_response.status_code != 200:
                error_text = token_response.text
                logger.error(
                    f"All token exchange attempts failed. Last error: {error_text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Supabase OAuth does NOT support backend code exchange. "
                        "Supabase must redirect directly to frontend with tokens in URL hash. "
                        "Check: 1) Supabase dashboard OAuth settings allow frontend URL, "
                        "2) redirect_to points to valid frontend callback URL, "
                        "3) Supabase redirects directly to frontend (not through backend). "
                        f"Error: {error_text}"
                    )
                )

            response_data = token_response.json()

            # Extract tokens from response
            access_token = response_data.get("access_token")
            refresh_token = response_data.get("refresh_token")

            # If response has session, extract from there
            if not access_token and "session" in response_data:
                session = response_data.get("session", {})
                access_token = session.get("access_token")
                refresh_token = session.get("refresh_token")

            if not access_token:
                logger.error(f"No access token in response: {response_data}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No access token received from OAuth provider"
                )

            # Get user info using the access token
            user_response = supabase.auth.get_user(access_token)
            user = user_response.user

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Failed to retrieve user information"
                )

        # Get user profile
        user_id = user.id
        user_profile = supabase.table("users").select(
            "*").eq("id", user_id).execute()

        user_data = {
            "id": user_id,
            "email": user.email,
            "full_name": user.user_metadata.get("full_name") if user.user_metadata else None,
        }

        if user_profile.data:
            user_data.update(user_profile.data[0])

        return AuthResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=user_data,
            expires_in=3600
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"OAuth callback error: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to complete OAuth authentication: {str(e)}"
        )


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token(request: RefreshTokenRequest):
    """
    Refresh an access token using a refresh token.

    Args:
        request: Refresh token request with refresh_token

    Returns:
        AuthResponse with new access token and refresh token
    """
    try:
        supabase = get_supabase_client()

        # Refresh the session
        auth_response = supabase.auth.refresh_session(request.refresh_token)

        if not auth_response.session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )

        return AuthResponse(
            access_token=auth_response.session.access_token,
            refresh_token=auth_response.session.refresh_token,
            user={
                "id": auth_response.user.id,
                "email": auth_response.user.email,
            },
            expires_in=auth_response.session.expires_in or 3600
        )

    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )


@router.post("/signout")
async def signout(current_user: dict = Depends(get_current_user)):
    """
    Sign out the current user.

    Invalidates the current session and refresh token.

    Args:
        current_user: Current authenticated user

    Returns:
        Success message
    """
    try:
        supabase = get_supabase_client()

        # Sign out user
        supabase.auth.sign_out()

        return {"message": "Successfully signed out"}

    except Exception as e:
        logger.error(f"Sign-out error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sign out"
        )


@router.get("/me")
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Args:
        current_user: Current authenticated user from dependency

    Returns:
        User information dictionary
    """
    return current_user
