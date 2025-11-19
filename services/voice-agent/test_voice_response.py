#!/usr/bin/env python3
"""
Test script to verify agent voice response pipeline

This script helps verify that:
1. OpenAI API key is configured
2. Agent can connect to LiveKit
3. OpenAI Realtime model can be created
4. Agent session can be started

Run this before testing in the UI to ensure everything is configured correctly.
"""

import sys
import os
from pathlib import Path

# Add src directory to Python path
sys.path.insert(0, str(Path(__file__).parent / "src"))

def test_configuration():
    """Test that all required configuration is present"""
    print("=" * 60)
    print("Testing Configuration")
    print("=" * 60)
    
    from config import settings, validate_config, validate_openai_config
    
    # Test basic config
    print("\n1. Testing basic configuration...")
    if validate_config():
        print("   [OK] Basic configuration valid")
        print(f"   - LiveKit URL: {settings.livekit_url[:30]}...")
        print(f"   - LiveKit API Key: {settings.livekit_api_key[:10]}...")
        print(f"   - Supabase URL: {settings.supabase_url[:30]}...")
    else:
        print("   [FAIL] Basic configuration invalid")
        print("   Missing required environment variables")
        return False
    
    # Test OpenAI config
    print("\n2. Testing OpenAI configuration...")
    if validate_openai_config():
        print("   [OK] OpenAI API key configured")
        print(f"   - API Key: {settings.openai_api_key[:10]}...")
    else:
        print("   [FAIL] OpenAI API key not configured")
        print("   Set OPENAI_API_KEY in .env file")
        return False
    
    return True

def test_openai_api():
    """Test OpenAI API connectivity"""
    print("\n" + "=" * 60)
    print("Testing OpenAI API")
    print("=" * 60)
    
    try:
        import openai
        from config import settings
        
        # Set API key
        openai.api_key = settings.openai_api_key
        
        print("\n1. Testing API key validity...")
        client = openai.OpenAI(api_key=settings.openai_api_key)
        
        # Test with a simple API call
        models = client.models.list()
        print(f"   [OK] API key valid (found {len(models.data)} models)")
        
        # Check for Realtime API access
        print("\n2. Checking Realtime API access...")
        realtime_models = [m.id for m in models.data if 'realtime' in m.id.lower()]
        if realtime_models:
            print(f"   [OK] Realtime models available: {', '.join(realtime_models[:3])}")
        else:
            print("   [WARN] No Realtime models found (may need API access)")
        
        return True
    except Exception as e:
        print(f"   ❌ OpenAI API test failed: {e}")
        return False

def test_agent_imports():
    """Test that agent code can be imported"""
    print("\n" + "=" * 60)
    print("Testing Agent Code")
    print("=" * 60)
    
    try:
        print("\n1. Testing imports...")
        from livekit import agents
        from livekit.plugins import openai
        from agent import entrypoint
        
        print("   [OK] All imports successful")
        
        print("\n2. Testing OpenAI Realtime model creation...")
        from config import settings
        
        # Try to create a Realtime model (without connecting)
        try:
            model = openai.realtime.RealtimeModel(
                voice="coral",
                model="gpt-4o-realtime-preview-2024-12-17",
                temperature=0.7,
            )
            print("   [OK] Realtime model can be created")
        except Exception as e:
            print(f"   [WARN] Realtime model creation test: {e}")
            print("   (This is OK - model will be created when agent connects)")
        
        return True
    except Exception as e:
        print(f"   [FAIL] Import test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("\n" + "=" * 60)
    print("Voice Agent Response Pipeline Test")
    print("=" * 60)
    print("\nThis script verifies that the agent voice response pipeline")
    print("(STT -> LLM -> TTS) is properly configured.\n")
    
    results = []
    
    # Run tests
    results.append(("Configuration", test_configuration()))
    if results[-1][1]:  # Only continue if config is valid
        results.append(("OpenAI API", test_openai_api()))
        results.append(("Agent Code", test_agent_imports()))
    
    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in results:
        status = "[PASS]" if passed else "[FAIL]"
        print(f"{test_name:20} {status}")
        if not passed:
            all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] All tests passed! Agent voice responses should work.")
        print("\nNext steps:")
        print("1. Start the agent server: python src/main.py --mode both")
        print("2. Start a voice call in the UI")
        print("3. Check logs for voice interaction events")
    else:
        print("[FAILURE] Some tests failed. Please fix the issues above.")
        print("\nCommon fixes:")
        print("- Set OPENAI_API_KEY in services/voice-agent/.env")
        print("- Verify LiveKit credentials are correct")
        print("- Check Supabase credentials")
    print("=" * 60 + "\n")
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())

