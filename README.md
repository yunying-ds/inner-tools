# Inner Tools - Sedona Method Release Application

🌐 **Live Site**: https://www.yunying-inner-tools.site

A web-based emotional release tool that guides users through the Sedona Method - a clinically validated technique for emotional wellness.

---

## 🎯 Project Overview

This project demonstrates **AI-assisted product development** where I served as the product designer and project lead, using Claude Code as the development tool to transform requirements into production-ready code.

### What This Project Represents

- ✅ **Product thinking**: Translating psychological theory into digital experience
- ✅ **AI engineering**: Managing AI as a development partner
- ✅ **User-centered iteration**: Real user testing → problem identification → solution design
- ✅ **Full-stack deployment**: From concept to production (GitHub → Vercel → Custom Domain)

---

## 🚀 Key Features

### 9-Step Release Process
1. **Emotion Identification** - AI-powered emotion recognition with multi-emotion support
2. **Acceptance** - Allowing the feeling to exist
3-5. **Three Core Questions** - Could you? Would you? When?
6. **Intensity Rating** - Track progress with 1-10 scale
7. **Three Core Wants** - Identify deeper patterns (approval/control/security)
8. **Want Release** - Let go of underlying attachments
9. **Integration** - Reflect and continue or complete

### Smart Flow Logic
- 🔄 **Intelligent looping**: Repeats steps 3-6 when intensity remains high (max 3 loops)
- 🎯 **Multi-emotion handling**: Process multiple emotions sequentially
- 🛡️ **Stuck detection**: Auto-advances after repeated high scores
- 📝 **Optional reflection**: Step 9 input pre-fills next session
- 🔀 **Reframe wants**: "Try different angle" generates alternative perspectives

---

## 👤 My Role & Contributions

### Product Design & Strategy
- Researched Sedona Method theory and designed digital adaptation
- Defined complete 9-step user flow with interaction patterns
- Specified emotion recognition logic and multi-emotion workflow
- Designed loop protection and stuck-prevention mechanisms

### Requirements Engineering
- Wrote detailed technical specifications for AI implementation
- Defined data structures, API interfaces, and state management
- Created phase-by-phase implementation roadmap
- Documented edge cases and error handling requirements

### User Testing & Iteration
**Real user testing revealed critical issues:**

| Issue Discovered | Root Cause | Solution Designed |
|-----------------|------------|-------------------|
| Hydration errors | SSR/client mismatch | Specified `ssr: false` + client component split |
| Multi-emotion flow breaks | State management bug | Designed queue-based sequential processing |
| Inaccurate "wants" | JSON parsing errors | Switched to `tool_use` API pattern |
| Users getting stuck | Infinite loops possible | Added MAX_LOOPS protection + "not improving" detection |

**Testing participants:**
- Myself (primary user flow validation)
- My husband (discovered key UX issues: concept confusion, loop traps)

### AI Engineering Management
- Managed Claude Code as development partner
- Provided clear problem descriptions to guide debugging
- Reviewed and approved AI-generated solutions
- Iterated through multiple rounds of refinement

### Deployment & Operations
- Set up GitHub repository and version control
- Deployed to Vercel with automatic CI/CD
- Configured custom domain: yunying-inner-tools.site
- Set up CDN proxy for China accessibility (no VPN required)

---

## 🤖 What Claude Code Built

### Core Implementation (~880 lines)
- `session-client.tsx`: Main state machine with 9-step flow
- Hydration fix: SSR/client boundary management
- Multi-emotion queue system
- Loop protection (3 max for basic release, 3 max for wants)
- API integration with Anthropic SDK

### API Endpoints
```
/api/release/identify-emotion    → Step 1: Emotion recognition
/api/release/generate-wants       → Step 7: Three wants (tool_use pattern)
/api/release/analyze-completion   → Step 9: Session analysis
```

### Features
- Home page with Sedona Method introduction
- Session history tracking
- Step 9 optional journaling with pre-fill
- "Reframe wants" button for alternative perspectives
- Responsive UI with Tailwind + shadcn/ui

---

## 🏗️ Architecture
```
inner-tools/
├── app/
│   ├── page.tsx                          # Landing page
│   ├── release/
│   │   ├── session/
│   │   │   ├── page.tsx                  # Thin wrapper (ssr: false)
│   │   │   └── session-client.tsx        # Main flow (~880 lines)
│   │   └── history/page.tsx              # Session history
│   └── api/release/                      # AI endpoints
│       ├── identify-emotion/
│       ├── generate-wants/               # Uses tool_use pattern
│       └── analyze-completion/
├── components/ui/                         # shadcn components
├── lib/release/emotions.ts               # Emotion taxonomy
├── types/release.ts                      # TypeScript definitions
└── .env.local                            # ANTHROPIC_API_KEY
```

---

## 💻 Tech Stack

### Development
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **UI**: Tailwind CSS + shadcn/ui + Radix UI
- **AI**: Anthropic Claude API
- **State**: React Hooks (useState, useEffect)

### Deployment
- **Version Control**: GitHub
- **Hosting**: Vercel (automatic deployments)
- **Domain**: Custom domain with DNS
- **CDN**: Global distribution + China proxy
- **Security**: Automatic HTTPS/TLS

### Development Process
- **AI Tool**: Claude Code for implementation
- **Workflow**: Requirements → AI Implementation → Testing → Iteration
- **Testing**: Real user feedback-driven development

---

## 🎓 Key Learnings

### 1. AI-Assisted Development is Viable
- Clear requirements matter more than coding ability
- AI can handle complex implementation (880-line state machine)
- Iteration speed is dramatically faster than traditional dev

### 2. User Testing is Still Critical
- AI can't predict real user behavior
- Husband's testing revealed issues I didn't anticipate
- Every round of testing led to meaningful improvements

### 3. Product Thinking > Technical Skills
- Understanding user needs and designing solutions is the bottleneck
- Technical implementation can be delegated to AI
- Domain expertise (psychology, UX) remains irreplaceable

### 4. Modern Deployment is Accessible
- GitHub + Vercel makes deployment trivial
- Custom domains and CDN are straightforward
- Non-technical founders can now ship products

---

## 🔄 Development Timeline

**Phase 1**: Initial Build (2 days)
- Core 9-step flow
- Basic emotion recognition
- Simple want generation

**Phase 2**: User Testing & Fixes (1 day)
- Fixed hydration errors
- Added multi-emotion support
- Implemented loop protection

**Phase 3**: Refinement (1 day)
- Switched to tool_use for wants
- Added "reframe wants" feature
- Improved error handling

**Phase 4**: Deployment (0.5 days)
- Vercel deployment
- Custom domain setup
- CDN configuration

**Total**: ~5 days from concept to production

---

## 🌟 Why This Project Matters

### For Users
- Free, accessible emotional wellness tool
- Evidence-based method (Sedona Method)
- No account required, works in China

### For Product Development
- Demonstrates viability of AI-assisted development
- Shows how non-coders can build complex products
- Proves rapid iteration is possible with AI tools

### For My Portfolio
- End-to-end product ownership
- User research and testing
- AI engineering and management
- Production deployment and operations

---

## 🚀 Future Enhancements

- [ ] Session persistence (save/resume)
- [ ] Export release records (PDF/JSON)
- [ ] Emotion trend visualization
- [ ] Guided audio for each step
- [ ] Multi-language support
- [ ] Mobile app (React Native)

---

## 📊 Metrics

- **Lines of Code**: ~880 (main flow) + API endpoints
- **Development Time**: 5 days (concept to production)
- **Testing Rounds**: 3 major iterations
- **User Testing**: 2 participants
- **Deployment Time**: < 2 minutes (automated)
- **Global Accessibility**: ✅ Including China (no VPN)

---

## 🤝 Acknowledgments

- **Development Tool**: Claude Code by Anthropic
- **UI Components**: shadcn/ui by shadcn
- **Hosting**: Vercel
- **Method**: The Sedona Method by Hale Dwoskin

---

## 📝 License

This project is open source for educational purposes. The Sedona Method itself is trademarked.

---

## 👩‍💻 About Me

I'm Yunying, exploring the intersection of:
- 🧘 Personal development & psychology  
- 🤖 AI-assisted product development  
- 📊 Data science & analytics

This project demonstrates how domain expertise + AI tools can create real products without traditional coding.

**Connect with me:**
- 🌐 Portfolio: https://www.yunying-inner-tools.site
- 💼 LinkedIn: [Your LinkedIn]
- 📧 Email: [Your Email]

---

**Note**: This project was built using AI-assisted development. I designed the product and wrote the specifications; Claude Code generated the implementation.