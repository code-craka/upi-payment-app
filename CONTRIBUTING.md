# Contributing to UPI Admin Dashboard

Thank you for your interest in contributing to the UPI Admin Dashboard! This guide will help you get started with development and contribution guidelines.

**Author**: Sayem Abdullah Rihan (@code-craka)  
**Contributor**: Sajjadul Islam  
**Contact**: <hello@techsci.io>  
**Repository**: <https://github.com/code-craka/upi-payment-app>

## 🚀 Quick Start

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: 18+ (LTS recommended)
- **pnpm**: Package manager (recommended over npm/yarn)
- **MongoDB**: 5.0+ with replica set support
- **Redis**: 6.2+ for session management (required)
- **Git**: For version control

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/code-craka/upi-payment-app.git
   cd upi-payment-app
   ```

2. **Install Dependencies**
   ```bash
   pnpm install
   ```

3. **Environment Configuration**
   Create a `.env.local` file with the following:
   ```env
   # Database
   MONGODB_URI=mongodb://localhost:27017/upi-admin-dashboard-dev
   
   # Redis (Required)
   REDIS_HOST=localhost
   REDIS_PORT=6379
   REDIS_PASSWORD=your-dev-password
   
   # Authentication (Clerk)
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
   
   # Security
   NEXTAUTH_SECRET=your-development-secret-key
   CSRF_SECRET=your-csrf-secret-key
   ```

4. **Start Development Server**
   ```bash
   pnpm dev
   ```

5. **Verify Setup**
   - Visit <http://localhost:3000>
   - Check API health: <http://localhost:3000/api/test-db>
   - Verify Redis connection: <http://localhost:3000/api/debug/session>
- Integration tests for API endpoints
- E2E tests for critical user flows

### Running Tests

\`\`\`bash

# Run all tests

pnpm test

# Run tests in watch mode

pnpm test:watch

# Generate coverage report

pnpm test:coverage
\`\`\`

### Writing Tests

- Use Jest for unit and integration tests
- Use React Testing Library for component tests
- Use Playwright for E2E tests
- Mock external dependencies appropriately

## 🔒 Security Considerations

### Security Requirements

- Never commit sensitive data (API keys, passwords)
- Implement proper input validation
- Use parameterized queries to prevent injection
- Follow OWASP security guidelines

### Authentication & Authorization

- All protected routes must verify user authentication
- Implement role-based access control
- Use secure session management
- Audit all sensitive operations

## 📝 Pull Request Process

### Before Submitting

1. Ensure all tests pass
2. Update documentation if needed
3. Follow the commit message format
4. Rebase your branch on the latest main

### Commit Message Format

\`\`\`
type(scope): description

[optional body]

[optional footer]
\`\`\`

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
\`\`\`
feat(payment): add UPI deep link integration

- Implement deep links for major UPI apps
- Add fallback for unsupported apps
- Update payment flow documentation

Closes #123
\`\`\`

### Pull Request Template

- Use the provided PR template
- Include screenshots for UI changes
- Reference related issues
- Provide testing instructions

## 🐛 Bug Reports

### Bug Report Template

When reporting bugs, please include:
- **Environment**: OS, Node.js version, browser
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: If applicable
- **Additional Context**: Any other relevant information

## 💡 Feature Requests

### Feature Request Template

- **Problem**: What problem does this solve?
- **Solution**: Proposed solution
- **Alternatives**: Alternative solutions considered
- **Additional Context**: Any other relevant information

## 📚 Documentation

### Documentation Standards

- Update README.md for significant changes
- Include JSDoc comments for functions
- Update API documentation for new endpoints
- Provide examples for complex features

### Documentation Structure

- README.md: Project overview and setup
- API.md: Detailed API documentation
- DEPLOYMENT.md: Deployment instructions
- SECURITY.md: Security guidelines

## 🏗️ Architecture Guidelines

### Folder Structure

\`\`\`
├── app/                 # Next.js App Router
│   ├── api/            # API routes
│   ├── admin/          # Admin dashboard
│   └── pay/            # Payment pages
├── components/         # React components
│   ├── ui/            # ShadCN UI components
│   ├── payment/       # Payment components
│   └── admin/         # Admin components
├── lib/               # Utilities and business logic
│   ├── auth/          # Authentication utilities
│   ├── db/            # Database models and queries
│   └── utils/         # Helper functions
└── types/             # TypeScript type definitions
\`\`\`

### Component Organization

- Group related components in folders
- Use index.ts files for clean imports
- Separate business logic from UI components
- Implement proper error boundaries

## 🔄 Release Process

### Version Management

- Follow Semantic Versioning (SemVer)
- Update CHANGELOG.md for each release
- Tag releases in Git
- Update package.json version

### Release Checklist

- [ ] All tests pass
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version bumped
- [ ] Security review completed
- [ ] Performance testing completed

## 🤝 Community Guidelines

### Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Follow the project's code of conduct

### Communication

- Use GitHub issues for bug reports and feature requests
- Use GitHub discussions for questions and ideas
- Be clear and concise in communications
- Provide context and examples when needed

## 📞 Getting Help

### Resources

- Project documentation
- GitHub issues and discussions
- Code comments and examples
- Community forums

### Contact

- Create an issue for bugs or feature requests
- Use discussions for questions
- Tag maintainers for urgent issues
- Follow up on stale issues

Thank you for contributing to the UPI Payment System! 🙏
\`\`\`

```text file="LICENSE"
MIT License

Copyright (c) 2024 UPI Payment System

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
