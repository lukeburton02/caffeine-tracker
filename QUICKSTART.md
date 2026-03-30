# 🚀 Quick Start Guide

## Step 1: Set Up Your Project

Open your terminal and run these commands:

```bash
# Create project directory
mkdir caffeine-tracker
cd caffeine-tracker

# Download the starter files (you'll get these from Claude)
# Then extract them into this directory
```

## Step 2: Install Node.js (if you don't have it)

**Check if you have it:**
```bash
node --version
```

**If not installed:**
- **Mac**: `brew install node`
- **Linux/WSL**: `sudo apt update && sudo apt install nodejs npm`
- **Windows**: Download from https://nodejs.org

## Step 3: Start the Development Server

```bash
# From your caffeine-tracker directory
npm run dev
```

You should see:
```
Starting up http-server, serving src
Available on:
  http://127.0.0.1:8080
  http://192.168.1.X:8080
```

## Step 4: Access on Your Android Phone

1. **Find your computer's IP address** (the 192.168.X.X one from above)

2. **On your phone, make sure you're on the same WiFi as your computer**

3. **Open Chrome on Android** and go to:
   ```
   http://192.168.1.X:8080
   ```
   (Replace X with your actual IP)

4. You should see the basic placeholder page!

## Step 5: Start Building with Claude Code

```bash
# In your project directory
claude-code
```

Then tell Claude:
```
Read TASKS.md and work on Task 1.2 - create the basic HTML structure for the caffeine tracker
```

## Common Issues

**"Cannot connect" on phone:**
- Make sure phone and computer are on same WiFi
- Check your firewall isn't blocking port 8080
- Try your computer's IP address, not localhost

**"command not found: npm":**
- You need to install Node.js first (see Step 2)

**"command not found: claude-code":**
- Install Claude Code: `npm install -g @anthropic-ai/claude-code`
- Or follow: https://code.claude.com/docs/en/overview

## Next Steps

1. ✅ Get the basic page showing on your phone
2. ✅ Start Claude Code and work through Phase 1 tasks
3. ✅ Test each feature on your Android device as you build
4. ✅ Once Phase 1 is done, you'll have a working caffeine tracker!

## Tips

- **Save often**: Claude Code auto-saves, but check the files were updated
- **Test on phone frequently**: Don't build everything then test - test as you go
- **Read CLAUDE.md**: It has all the context Claude needs to build this right
- **Follow TASKS.md**: The tasks are ordered for a reason - do them in sequence

Good luck! 🎉
