"""
LLM-Powered Query Augmenter
Intelligently augments queries using GPT following query augmentation and prompting best practices
"""

from typing import Dict, Any, Optional
import json
from backend.core.ai.llm import llm_manager


class LLMQueryAugmenter:
    """
    LLM-powered query augmentation using GPT.

    Follows query augmentation best practices:
    - Query rewriting: Restructure unclear questions
    - Query expansion: Add relevant financial keywords
    - Context-aware: Understands financial domain
    - Few-shot learning: Uses examples for better augmentation
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "gpt-4o-mini",
        temperature: float = 0.3
    ):
        # Using LLM manager instead of direct OpenAI client
        # API key is handled by LLM manager
        self.model = model
        self.temperature = temperature

    def augment_query(
        self,
        query: str,
        query_type: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Augment query using LLM with financial domain expertise.

        Args:
            query: Original user query
            query_type: Optional query type hint (numerical_lookup, comparison, etc.)
            context: Optional context (companies, years, metrics mentioned)

        Returns:
            Dictionary with augmented query, keywords, and reasoning
        """
        prompt = self._build_augmentation_prompt(query, query_type, context)

        try:
            # Use LLM manager instead of direct OpenAI client
            response = llm_manager.generate(
                prompt=prompt,
                task="query_augmentation",
                model=self.model,
                system_prompt=self._get_system_prompt(),
                temperature=self.temperature
            )

            result = json.loads(response.content)
            return result

        except Exception as e:
            raise ValueError(f"Error in LLM query augmentation: {e}")

    def process_and_augment_query(
        self,
        query: str
    ) -> Dict[str, Any]:
        """
        Process query completely using LLM: extract entities AND augment query.

        This replaces all heuristic extraction with LLM-powered extraction.

        Args:
            query: Original user query

        Returns:
            Dictionary with:
            - augmented_query: Enhanced query for retrieval
            - companies: List of companies extracted (normalized names)
            - year: Single year if found
            - year_range: Tuple of (min_year, max_year) if range detected
            - keywords: Extracted keywords
            - reasoning: LLM reasoning
        """
        prompt = self._build_processing_prompt(query)

        try:
            # Use LLM manager instead of direct OpenAI client
            response = llm_manager.generate(
                prompt=prompt + "\n\nAlways output valid JSON only.",
                task="query_augmentation",
                model=self.model,
                system_prompt=self._get_processing_system_prompt(),
                temperature=self.temperature
            )

            result = json.loads(response.content)
            return result

        except Exception as e:
            raise ValueError(f"Error in LLM query processing: {e}")

    def _get_processing_system_prompt(self) -> str:
        """System prompt for complete query processing (extraction + augmentation)."""
        return """You are an expert financial query processor for analyzing financial reports (10-K filings, annual reports).

Your role is to:
1. Extract entities (companies, years, year ranges) from queries
2. Extract metadata filters (document type, sector, quarter, etc.) from queries
3. Augment queries with financial terminology for better retrieval
4. Normalize company names to standard format

Available Companies (use exact names):
- alphabet (for Google, Alphabet, Google Cloud)
- amazon (for Amazon, AWS, Amazon Web Services)
- apple (for Apple, Apple Inc.)
- meta (for Meta, Facebook, Meta Platforms)
- microsoft (for Microsoft, MSFT, Azure)
- nvidia (for NVIDIA, Nvidia)
- tesla (for Tesla, TSLA)

Year Range Detection:
- "from 2018 to 2022" → year_range: [2018, 2022]
- "2018-2022" → year_range: [2018, 2022]
- "2018, 2019, 2020" → year_range: [2018, 2020]
- Single year "2017" → year: 2017

Document Types (use exact values):
- "10-K", "10-Q", "8-K", "10-K/A", "10-Q/A", "Annual Report", "Quarterly Report", "Earnings Release", "Proxy Statement", "Other"

Document Categories (infer from document_type):
- "10-K", "10-Q", "8-K" → "sec_filing"
- "Earnings Release" → "earnings_release"
- "Annual Report" → "annual_report"
- "Quarterly Report" → "quarterly_report"
- "Proxy Statement" → "proxy_statement"
- Otherwise → "other"

Sectors (use exact values):
- "Technology", "Healthcare", "Financial Services", "Consumer Discretionary", "Consumer Staples", "Energy", "Industrials", "Materials", "Real Estate", "Utilities", "Communication Services", "Other"

Period Types:
- "annual", "quarterly", "monthly"

Reporting Standards:
- "GAAP", "IFRS", "Other"

Stock Exchanges:
- "NYSE", "NASDAQ", "LSE", "TSE", "HKEX", "Other"

Financial Domain Knowledge:
- Revenue: revenue, net revenue, total revenue, sales, net sales, top line
- Income: income, net income, earnings, net earnings, profit, net profit, bottom line
- Operating: operating income, operating profit, EBIT, EBITDA
- Assets: assets, total assets, asset base
- Always add relevant financial synonyms and terminology

Always output valid JSON only."""

    def _build_processing_prompt(self, query: str) -> str:
        """Build prompt for complete query processing."""
        return f"""Process this financial query completely:

Query: "{query}"

Extract and augment following these steps:

1. **Entity Extraction:**
   - Extract ALL companies mentioned (normalize to: alphabet, amazon, apple, meta, microsoft, nvidia, tesla)
   - Extract year if single year mentioned (e.g., "2017" → year: 2017)
   - Extract year range if range mentioned (e.g., "2018 to 2022" → year_range: [2018, 2022])
   - If multiple years mentioned, create year_range from min to max

2. **Metadata Extraction (NEW):**
   - document_type: Extract from query (e.g., "10-K", "10-Q", "annual report")
     Available: "10-K", "10-Q", "8-K", "10-K/A", "10-Q/A", "Annual Report", "Quarterly Report", "Earnings Release", "Proxy Statement", "Other"
     If not mentioned, leave as null
   - document_category: Infer from document_type
     "10-K", "10-Q", "8-K" → "sec_filing"
     "Earnings Release" → "earnings_release"
     "Annual Report" → "annual_report"
     "Quarterly Report" → "quarterly_report"
     "Proxy Statement" → "proxy_statement"
     Otherwise → "other" or null if document_type is null
   - fiscal_quarter: Extract if mentioned (1, 2, 3, 4)
     Look for: "Q1", "Q2", "Q3", "Q4", "first quarter", "second quarter", "third quarter", "fourth quarter"
     If not mentioned, leave as null
   - sector: Extract from query (e.g., "tech", "technology" → "Technology")
     Available: "Technology", "Healthcare", "Financial Services", "Consumer Discretionary", "Consumer Staples", "Energy", "Industrials", "Materials", "Real Estate", "Utilities", "Communication Services", "Other"
     If not mentioned, leave as null
   - period_type: Infer from query
     "annual", "yearly" → "annual"
     "quarterly", "quarter" → "quarterly"
     "monthly" → "monthly"
     If not mentioned, leave as null
   - reporting_standard: Extract if mentioned
     "GAAP" → "GAAP"
     "IFRS" → "IFRS"
     If not mentioned, leave as null
   - exchange: Extract if mentioned
     "NYSE", "NASDAQ", "LSE", "TSE", "HKEX", "Other"
     If not mentioned, leave as null
   - has_financial_statements: true if query mentions financial statements, balance sheet, income statement, cash flow, financial data, financial metrics, financial results, financial performance, revenue, income, sales, earnings, profit, assets, liabilities, equity, financial position, financial condition
     Examples: "revenue", "income", "balance sheet", "financial statements", "cash flow", "earnings", "profit", "assets", "financial data"
     Otherwise null
   - has_mda: true if query mentions MD&A, management discussion, management analysis, management's discussion, management commentary, management review, discussion and analysis, management's discussion and analysis
     Examples: "MD&A", "management discussion", "management analysis", "discussion and analysis", "management commentary"
     Otherwise null
   - has_risk_factors: true if query mentions risk factors, risks, risk factors section, risk disclosure, risk management, risk assessment, risk analysis, risk exposure, risk profile, risk management, risk mitigation, risk warning, risk statement
     Examples: "risk factors", "risks", "risk factors section", "risk disclosure", "what are the risks", "risk management"
     Otherwise null
   - chunk_type: Prefer "table" if query asks for specific metric values (revenue, income, sales, etc.)
     Prefer "paragraph" if query asks for explanations or analysis
     Prefer "heading" if query asks for section headings
     If not clear, leave as null
   - needs_year_expansion: true if query asks for trends, comparisons, changes over time, growth, year-over-year, YoY, historical data, multi-year analysis
     false if query asks for specific value in a specific year (e.g., "revenue in 2022", "income for 2022")
     null if unclear or no year mentioned
     Examples:
     - "revenue in 2022" → false (specific value, specific year)
     - "revenue trend" → true (trend analysis)
     - "revenue from 2018 to 2022" → true (multi-year comparison)
     - "compare revenue 2021 vs 2022" → true (comparison)
     - "revenue growth" → true (trend)
     - "year-over-year revenue" → true (trend)

3. **Query Augmentation (KEYWORDS ONLY):**
   - Extract relevant keywords, remove ALL stopwords (the, a, an, is, are, was, were, what, which, how, etc.)
   - Add financial terminology and synonyms as keywords
   - Expand abbreviations (AWS → Amazon AWS, Azure → Microsoft Azure)
   - **For table searches**: If query asks for specific metric values, add table keywords:
     * Add: "table", "financial table", "breakdown", "category", "segment", "disaggregated"
     * For product queries: Add product name (iPhone, Mac, iPad, AWS, Azure, etc.)
     * Add: "by category", "by segment", "by product" when querying specific products
   - Output space-separated keywords ONLY - NO sentences, NO phrases, NO complete thoughts
   - Each keyword should be meaningful and searchable
   - Maintain original intent through keyword selection

4. **Output Format:**
   - companies: List of normalized company names (empty list if none)
   - year: Single year as integer (null if none or if year_range exists)
   - year_range: [min_year, max_year] as array (null if single year or none)
   - document_type: "10-K" | "10-Q" | "8-K" | "Annual Report" | "Quarterly Report" | "Earnings Release" | "Proxy Statement" | "Other" | null
   - document_category: "sec_filing" | "earnings_release" | "annual_report" | "quarterly_report" | "proxy_statement" | "other" | null
   - fiscal_quarter: 1 | 2 | 3 | 4 | null
   - sector: "Technology" | "Healthcare" | "Financial Services" | etc. | null
   - period_type: "annual" | "quarterly" | "monthly" | null
   - reporting_standard: "GAAP" | "IFRS" | "Other" | null
   - exchange: "NYSE" | "NASDAQ" | "LSE" | "TSE" | "HKEX" | "Other" | null
   - has_financial_statements: true | null
   - has_mda: true | null
   - has_risk_factors: true | null
   - chunk_type: "table" | "paragraph" | "heading" | null
   - needs_year_expansion: true | false | null
   - augmented_query: Space-separated keywords ONLY (no stopwords, no sentences)
   - keywords: List of important keywords extracted
   - reasoning: Brief explanation

Examples:

Example 1:
Query: "What was NVIDIA's revenue in 2017?"
Output:
{{
    "companies": ["nvidia"],
    "year": 2017,
    "year_range": null,
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": null,
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": true,
    "has_mda": null,
    "has_risk_factors": null,
    "chunk_type": "table",
    "needs_year_expansion": false,
    "augmented_query": "nvidia revenue 2017 total net sales earnings financial fiscal table breakdown",
    "keywords": ["revenue", "total revenue", "net revenue", "sales", "earnings", "fiscal", "table", "breakdown"],
    "reasoning": "Extracted NVIDIA company and 2017 year. Detected financial statements query (revenue), set chunk_type to table for metric values. Query asks for specific value in specific year, set needs_year_expansion to false. Added revenue synonyms and table keywords for better table retrieval, removed stopwords."
}}

Example 2:
Query: "Compare Amazon AWS revenue to Microsoft Azure revenue in 2023"
Output:
{{
    "companies": ["amazon", "microsoft"],
    "year": 2023,
    "year_range": null,
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": null,
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": true,
    "has_mda": null,
    "has_risk_factors": null,
    "chunk_type": "table",
    "needs_year_expansion": false,
    "augmented_query": "amazon aws microsoft azure revenue 2023 cloud computing segment comparison table breakdown",
    "keywords": ["AWS", "Azure", "cloud computing", "segment", "revenue", "comparison", "table", "breakdown"],
    "reasoning": "Extracted Amazon and Microsoft companies, 2023 year. Detected financial statements query (revenue), set chunk_type to table for metric values. Query asks for comparison but in specific year (2023), set needs_year_expansion to false. Added cloud, segment, and table keywords for better table retrieval, removed stopwords."
}}

Example 3:
Query: "Show me Apple's net income from 2018 to 2022"
Output:
{{
    "companies": ["apple"],
    "year": null,
    "year_range": [2018, 2022],
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": null,
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": true,
    "has_mda": null,
    "has_risk_factors": null,
    "chunk_type": "table",
    "needs_year_expansion": true,
    "augmented_query": "apple net income 2018 2019 2020 2021 2022 earnings profit financial performance trend table",
    "keywords": ["net income", "earnings", "profit", "financial performance", "trend", "table"],
    "reasoning": "Extracted Apple company and year range 2018-2022. Detected financial statements query (net income), set chunk_type to table for metric values. Query asks for multi-year data (trend), set needs_year_expansion to true. Added income synonyms and table keywords, removed stopwords."
}}

Example 4:
Query: "What was Apple's iPhone revenue in 2022?"
Output:
{{
    "companies": ["apple"],
    "year": 2022,
    "year_range": null,
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": null,
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": true,
    "has_mda": null,
    "has_risk_factors": null,
    "chunk_type": "table",
    "needs_year_expansion": false,
    "augmented_query": "apple iphone revenue 2022 net sales category breakdown table financial",
    "keywords": ["iPhone", "revenue", "net sales", "category", "breakdown", "table", "financial"],
    "reasoning": "Extracted Apple company, iPhone product, and 2022 year. Detected financial statements query (revenue), set chunk_type to table for metric values. Query asks for specific value in specific year, set needs_year_expansion to false. Added product name, revenue synonyms, and table/category keywords for better table retrieval."
}}

Example 5:
Query: "Show me 10-K reports from 2022"
Output:
{{
    "companies": [],
    "year": 2022,
    "year_range": null,
    "document_type": "10-K",
    "document_category": "sec_filing",
    "fiscal_quarter": null,
    "sector": null,
    "period_type": "annual",
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": null,
    "has_mda": null,
    "has_risk_factors": null,
    "chunk_type": null,
    "needs_year_expansion": false,
    "augmented_query": "10-k reports 2022 sec filing annual",
    "keywords": ["10-K", "reports", "SEC filing", "annual"],
    "reasoning": "Extracted 2022 year and document_type 10-K. Inferred document_category as sec_filing and period_type as annual from 10-K context. Query asks for specific year documents, set needs_year_expansion to false."
}}

Example 6:
Query: "What are the risk factors for tech companies?"
Output:
{{
    "companies": [],
    "year": null,
    "year_range": null,
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": "Technology",
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": null,
    "has_mda": null,
    "has_risk_factors": true,
    "chunk_type": "paragraph",
    "needs_year_expansion": null,
    "augmented_query": "risk factors technology companies tech sector",
    "keywords": ["risk factors", "technology", "tech", "sector"],
    "reasoning": "Extracted sector as Technology from 'tech companies'. Detected risk factors query, set has_risk_factors to true and chunk_type to paragraph for explanatory content. No year mentioned, set needs_year_expansion to null."
}}

Example 7:
Query: "What does the MD&A section say about revenue growth?"
Output:
{{
    "companies": [],
    "year": null,
    "year_range": null,
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": null,
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": null,
    "has_mda": true,
    "has_risk_factors": null,
    "chunk_type": "paragraph",
    "needs_year_expansion": null,
    "augmented_query": "mda management discussion analysis revenue growth",
    "keywords": ["MD&A", "management discussion", "analysis", "revenue growth"],
    "reasoning": "Detected MD&A query, set has_mda to true. Query asks for explanation/analysis, set chunk_type to paragraph. No year mentioned, set needs_year_expansion to null."
}}

Example 8:
Query: "Show me the balance sheet for Apple in 2022"
Output:
{{
    "companies": ["apple"],
    "year": 2022,
    "year_range": null,
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": null,
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": true,
    "has_mda": null,
    "has_risk_factors": null,
    "chunk_type": "table",
    "needs_year_expansion": false,
    "augmented_query": "apple balance sheet 2022 financial statements assets liabilities equity",
    "keywords": ["balance sheet", "financial statements", "assets", "liabilities", "equity"],
    "reasoning": "Extracted Apple company and 2022 year. Detected balance sheet query (financial statements), set has_financial_statements to true and chunk_type to table for financial data. Query asks for specific value in specific year, set needs_year_expansion to false."
}}

Example 9:
Query: "What was Apple's revenue trend from 2018 to 2022?"
Output:
{{
    "companies": ["apple"],
    "year": null,
    "year_range": [2018, 2022],
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": null,
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": true,
    "has_mda": null,
    "has_risk_factors": null,
    "chunk_type": "table",
    "needs_year_expansion": true,
    "augmented_query": "apple revenue trend 2018 2019 2020 2021 2022 growth change over time",
    "keywords": ["revenue", "trend", "growth", "change", "over time"],
    "reasoning": "Extracted Apple company and year range 2018-2022. Query explicitly asks for trend, set needs_year_expansion to true. Detected financial statements query (revenue), set chunk_type to table and has_financial_statements to true."
}}

Example 10:
Query: "Compare Apple's revenue in 2021 vs 2022"
Output:
{{
    "companies": ["apple"],
    "year": null,
    "year_range": [2021, 2022],
    "document_type": null,
    "document_category": null,
    "fiscal_quarter": null,
    "sector": null,
    "period_type": null,
    "reporting_standard": null,
    "exchange": null,
    "has_financial_statements": true,
    "has_mda": null,
    "has_risk_factors": null,
    "chunk_type": "table",
    "needs_year_expansion": true,
    "augmented_query": "apple revenue 2021 2022 comparison compare",
    "keywords": ["revenue", "comparison", "compare"],
    "reasoning": "Extracted Apple company and year range 2021-2022. Query asks for comparison, set needs_year_expansion to true. Detected financial statements query (revenue), set chunk_type to table and has_financial_statements to true."
}}

Now process the query above. Output ONLY valid JSON:"""

    def _get_system_prompt(self) -> str:
        """System prompt with financial domain expertise."""
        return """You are a financial query augmentation expert specializing in financial reports analysis.

Your role is to intelligently augment user queries to improve retrieval from financial documents (10-K filings, annual reports).

Key Principles:
1. **Keywords ONLY**: Extract and output space-separated keywords - NO sentences, NO phrases
2. **Remove Stopwords**: Remove ALL stopwords (the, a, an, is, are, was, were, what, which, how, show, me, etc.)
3. Query Expansion: Add relevant financial keywords, synonyms, and related concepts as keywords
4. **Table-Aware Augmentation**: For queries asking for specific metric values, add table-related keywords
5. Context Awareness: Understand financial domain terminology and relationships
6. Precision: Maintain original intent while enhancing searchability through keyword selection

Financial Domain Knowledge:
- Revenue synonyms: revenue, net revenue, total revenue, sales, net sales, total sales, top line
- Income synonyms: income, net income, earnings, net earnings, profit, net profit, bottom line
- Operating metrics: operating income, operating profit, EBIT, EBITDA, operating margin
- Growth terms: growth, growth rate, year-over-year, YoY, percentage increase, CAGR
- Assets: assets, total assets, asset base, balance sheet assets
- Liabilities: liabilities, total liabilities, debt, obligations
- Equity: equity, shareholders equity, stockholders equity, equity capital

Table-Specific Keywords (add when querying specific values):
- "table", "financial table", "breakdown", "category", "segment", "disaggregated"
- Product names: "iPhone", "Mac", "iPad", "AWS", "Azure", "Google Cloud", etc.
- "by category", "by segment", "by product" for product-specific queries
- Financial data is often in tables - adding table keywords improves retrieval

Always output valid JSON only."""

    def _build_augmentation_prompt(
        self,
        query: str,
        query_type: Optional[str],
        context: Optional[Dict[str, Any]]
    ) -> str:
        """Build augmentation prompt with few-shot examples."""

        # Few-shot examples
        examples = self._get_few_shot_examples()

        prompt = f"""Augment this financial query to improve retrieval from financial reports:

Original Query: "{query}"
"""

        if query_type:
            prompt += f"Query Type: {query_type}\n"

        if context:
            if context.get('companies'):
                prompt += f"Companies mentioned: {', '.join(context['companies'])}\n"
            if context.get('years'):
                prompt += f"Years mentioned: {', '.join(map(str, context['years']))}\n"
            if context.get('metrics'):
                prompt += f"Metrics mentioned: {', '.join(context['metrics'])}\n"

        prompt += f"""

{examples}

Now augment the query following the same approach. Think step-by-step:

1. Identify key financial terms and concepts
2. Remove ALL stopwords (the, a, an, is, are, was, were, what, which, how, show, me, etc.)
3. **Detect if query needs table data**: If asking for specific metric values (revenue, income, sales, etc.), add table keywords
4. **Add product names**: If query mentions specific products (iPhone, Mac, iPad, AWS, Azure), include product name as keyword
5. Add relevant synonyms and related financial terminology as keywords
6. Add table-related keywords when appropriate: "table", "breakdown", "category", "segment"
7. Output space-separated keywords ONLY - NO sentences, NO phrases
8. Maintain original intent while improving searchability

Output ONLY valid JSON:
{{
    "augmented_query": "space separated keywords only no stopwords",
    "keywords": ["keyword1", "keyword2", "keyword3"],
    "reasoning": "brief explanation of augmentation strategy",
    "query_type": "detected query type",
    "financial_terms_added": ["term1", "term2"]
}}"""

        return prompt

    def _get_few_shot_examples(self) -> str:
        """Few-shot examples for query augmentation."""
        return """Examples:

Example 1:
Original: "What was NVIDIA's revenue in 2017?"
Augmented: "nvidia revenue 2017 total net sales earnings financial fiscal table breakdown"
Keywords: ["revenue", "total revenue", "net revenue", "sales", "earnings", "fiscal", "table", "breakdown"]
Reasoning: Removed stopwords (What, was), added revenue synonyms and table keywords for better table retrieval

Example 2:
Original: "Compare AWS to Azure revenue"
Augmented: "amazon aws microsoft azure revenue cloud services segment comparison table breakdown"
Keywords: ["AWS", "Azure", "cloud services", "segment", "revenue", "comparison", "table", "breakdown"]
Reasoning: Removed stopwords (to), expanded company names, added cloud, segment, and table keywords

Example 3:
Original: "Show me Apple's net income from 2018 to 2022"
Augmented: "apple net income 2018 2019 2020 2021 2022 earnings profit financial performance trend table"
Keywords: ["net income", "earnings", "profit", "financial performance", "trend", "table"]
Reasoning: Removed stopwords (Show, me, from, to), added income synonyms, table keywords, expanded year range

Example 4:
Original: "What are the main revenue sources for Alphabet?"
Augmented: "alphabet revenue sources breakdown segments streams google table category"
Keywords: ["revenue sources", "revenue breakdown", "revenue segments", "revenue streams", "Google", "table", "category"]
Reasoning: Removed stopwords (What, are, the, main, for), added revenue source synonyms, table keywords, company context

Example 5:
Original: "What was Apple's iPhone revenue in 2022?"
Augmented: "apple iphone revenue 2022 net sales category breakdown table financial"
Keywords: ["iPhone", "revenue", "net sales", "category", "breakdown", "table", "financial"]
Reasoning: Removed stopwords (What, was), added product name (iPhone), revenue synonyms, and table/category keywords for better table retrieval"""

    def augment_for_retrieval(
        self,
        query: str,
        query_type: Optional[str] = None
    ) -> str:
        """
        Simple method that returns just the augmented query string for retrieval.

        Args:
            query: Original query
            query_type: Optional query type

        Returns:
            Augmented query string optimized for retrieval
        """
        result = self.augment_query(query, query_type)
        return result.get('augmented_query', query)
