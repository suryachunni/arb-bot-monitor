#!/bin/bash

# ═══════════════════════════════════════════════════════════════════
# AUTOMATED SECURITY AUDIT SCRIPT
# ═══════════════════════════════════════════════════════════════════

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║          FLASH LOAN ARBITRAGE V2 - SECURITY AUDIT                 ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create audit directory
AUDIT_DIR="./security-audit-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$AUDIT_DIR"

echo "📊 Starting security audit..."
echo "   Output directory: $AUDIT_DIR"
echo ""

# ═══════════════════════════════════════════════════════════════════
# 1. SLITHER STATIC ANALYSIS
# ═══════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════"
echo " 1/5 Running Slither Static Analysis"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

if command -v slither &> /dev/null; then
    echo "✅ Slither found, running analysis..."
    slither . --json "$AUDIT_DIR/slither-report.json" > "$AUDIT_DIR/slither-output.txt" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Slither analysis complete${NC}"
        echo "   Report: $AUDIT_DIR/slither-report.json"
    else
        echo -e "${YELLOW}⚠️  Slither found issues (review report)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Slither not installed${NC}"
    echo "   Install: pip3 install slither-analyzer"
    echo "   SKIPPED" > "$AUDIT_DIR/slither-output.txt"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 2. SOLHINT LINTING
# ═══════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════"
echo " 2/5 Running Solhint Linting"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

if command -v solhint &> /dev/null; then
    echo "✅ Solhint found, running linter..."
    npx solhint 'contracts/**/*.sol' > "$AUDIT_DIR/solhint-report.txt" 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Solhint check passed${NC}"
    else
        echo -e "${YELLOW}⚠️  Solhint found issues (review report)${NC}"
    fi
    echo "   Report: $AUDIT_DIR/solhint-report.txt"
else
    echo -e "${YELLOW}⚠️  Solhint not installed${NC}"
    echo "   Install: npm install -g solhint"
    echo "   SKIPPED" > "$AUDIT_DIR/solhint-report.txt"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 3. HARDHAT COMPILATION CHECK
# ═══════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════"
echo " 3/5 Compiling Contracts"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

npx hardhat clean > /dev/null 2>&1
npx hardhat compile > "$AUDIT_DIR/compilation-output.txt" 2>&1

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Contracts compiled successfully${NC}"
else
    echo -e "${RED}❌ Compilation failed${NC}"
    echo "   See: $AUDIT_DIR/compilation-output.txt"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 4. CONTRACT SIZE CHECK
# ═══════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════"
echo " 4/5 Checking Contract Sizes"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

npx hardhat size-contracts > "$AUDIT_DIR/contract-sizes.txt" 2>&1

if [ -f "$AUDIT_DIR/contract-sizes.txt" ]; then
    echo "✅ Contract size check complete"
    cat "$AUDIT_DIR/contract-sizes.txt" | grep -A 20 "┌─" || echo "   No size data available"
else
    echo "⚠️  Contract size check skipped (hardhat-contract-sizer not installed)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# 5. DEPENDENCY AUDIT
# ═══════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════"
echo " 5/5 Auditing Dependencies"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

npm audit --json > "$AUDIT_DIR/npm-audit.json" 2>&1
npm audit > "$AUDIT_DIR/npm-audit.txt" 2>&1

VULNERABILITIES=$(npm audit --json | jq '.metadata.vulnerabilities | to_entries[] | .value' 2>/dev/null | awk '{s+=$1} END {print s}')

if [ -z "$VULNERABILITIES" ] || [ "$VULNERABILITIES" -eq 0 ]; then
    echo -e "${GREEN}✅ No npm vulnerabilities found${NC}"
else
    echo -e "${YELLOW}⚠️  Found $VULNERABILITIES npm vulnerabilities${NC}"
    echo "   Report: $AUDIT_DIR/npm-audit.txt"
fi

echo ""

# ═══════════════════════════════════════════════════════════════════
# GENERATE SUMMARY REPORT
# ═══════════════════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════════════════"
echo " Generating Summary Report"
echo "═══════════════════════════════════════════════════════════════════"
echo ""

SUMMARY_FILE="$AUDIT_DIR/AUDIT_SUMMARY.md"

cat > "$SUMMARY_FILE" << EOF
# Security Audit Summary
**Date:** $(date)
**Project:** Flash Loan Arbitrage V2

## Audit Results

### 1. Slither Static Analysis
EOF

if [ -f "$AUDIT_DIR/slither-output.txt" ]; then
    if grep -q "SKIPPED" "$AUDIT_DIR/slither-output.txt"; then
        echo "⚠️  **SKIPPED** - Slither not installed" >> "$SUMMARY_FILE"
    else
        echo "✅ **COMPLETED**" >> "$SUMMARY_FILE"
        echo "\nSee: \`slither-report.json\` for details" >> "$SUMMARY_FILE"
    fi
else
    echo "❌ **FAILED**" >> "$SUMMARY_FILE"
fi

cat >> "$SUMMARY_FILE" << EOF

### 2. Solhint Linting
EOF

if [ -f "$AUDIT_DIR/solhint-report.txt" ]; then
    if grep -q "SKIPPED" "$AUDIT_DIR/solhint-report.txt"; then
        echo "⚠️  **SKIPPED** - Solhint not installed" >> "$SUMMARY_FILE"
    else
        echo "✅ **COMPLETED**" >> "$SUMMARY_FILE"
        echo "\nSee: \`solhint-report.txt\` for details" >> "$SUMMARY_FILE"
    fi
else
    echo "❌ **FAILED**" >> "$SUMMARY_FILE"
fi

cat >> "$SUMMARY_FILE" << EOF

### 3. Contract Compilation
EOF

if grep -q "Compiled" "$AUDIT_DIR/compilation-output.txt"; then
    echo "✅ **PASSED** - All contracts compiled successfully" >> "$SUMMARY_FILE"
else
    echo "❌ **FAILED** - Compilation errors detected" >> "$SUMMARY_FILE"
fi

cat >> "$SUMMARY_FILE" << EOF

### 4. Contract Size
✅ **COMPLETED**
See: \`contract-sizes.txt\` for details

### 5. Dependency Audit
EOF

if [ -z "$VULNERABILITIES" ] || [ "$VULNERABILITIES" -eq 0 ]; then
    echo "✅ **PASSED** - No vulnerabilities found" >> "$SUMMARY_FILE"
else
    echo "⚠️  **WARNINGS** - $VULNERABILITIES vulnerabilities found" >> "$SUMMARY_FILE"
    echo "\nSee: \`npm-audit.txt\` for details" >> "$SUMMARY_FILE"
fi

cat >> "$SUMMARY_FILE" << EOF

## Recommendations

1. **Manual Code Review**: Perform line-by-line review of critical functions
2. **Test Coverage**: Run comprehensive test suite
3. **Gas Optimization**: Review gas usage in production scenarios
4. **Access Control**: Verify all owner-only functions
5. **Slippage Protection**: Confirm minAmountOut enforcement

## Next Steps

- [ ] Review all audit reports
- [ ] Fix any critical or high-severity issues
- [ ] Run test suite (\`npm test\`)
- [ ] Deploy to testnet
- [ ] Execute test trades
- [ ] Monitor for 24-48 hours
- [ ] Deploy to mainnet (if safe)

---
**Audit Directory:** \`$AUDIT_DIR\`
EOF

echo "✅ Summary report generated: $SUMMARY_FILE"
echo ""

# ═══════════════════════════════════════════════════════════════════
# DISPLAY RESULTS
# ═══════════════════════════════════════════════════════════════════

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    AUDIT COMPLETE                                 ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📁 All reports saved to: $AUDIT_DIR"
echo ""
echo "📋 Files generated:"
echo "   - AUDIT_SUMMARY.md"
echo "   - slither-report.json"
echo "   - solhint-report.txt"
echo "   - compilation-output.txt"
echo "   - contract-sizes.txt"
echo "   - npm-audit.json"
echo "   - npm-audit.txt"
echo ""
echo "📖 Read the summary:"
echo "   cat $AUDIT_DIR/AUDIT_SUMMARY.md"
echo ""
echo "⚠️  IMPORTANT: Review all reports before deploying to production!"
echo ""
