"""
Keyword search utilities with proper tokenization and BM25 scoring
"""

import re
from typing import List, Dict, Optional
from collections import Counter
import math


class KeywordSearcher:
    """Proper keyword search with tokenization and BM25-like scoring, optimized for financial documents."""

    def __init__(self):
        # Common stop words in financial documents (reduced set - keep financial context words)
        self.stop_words = {
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
            'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
            'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
            'would', 'should', 'could', 'may', 'might', 'must', 'can', 'this',
            'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
            'we', 'our', 'us', 'you', 'your', 'he', 'she', 'his', 'her'
        }

        # Financial terminology - important phrases that should be preserved
        self.financial_phrases = {
            'operating income', 'net income', 'gross profit', 'revenue growth',
            'cash flow', 'operating cash flow', 'free cash flow', 'cash flow from operations',
            'total revenue', 'net revenue', 'gross revenue', 'revenue recognition',
            'earnings per share', 'diluted eps', 'basic eps',
            'return on equity', 'return on assets', 'return on investment',
            'ebitda', 'adjusted ebitda', 'non-gaap',
            'cost of revenue', 'cost of goods sold', 'operating expenses',
            'research and development', 'sales and marketing', 'general and administrative',
            'total assets', 'total liabilities', 'shareholders equity', 'stockholders equity',
            'working capital', 'current assets', 'current liabilities',
            'debt to equity', 'debt ratio', 'leverage ratio',
            'year over year', 'quarter over quarter', 'sequential growth',
            'fiscal year', 'annual report', 'quarterly report',
            'amazon web services', 'aws', 'azure', 'google cloud',
            'segment revenue', 'geographic revenue', 'product revenue', 'service revenue'
        }

        # Financial abbreviations and acronyms
        self.financial_abbreviations = {
            'gaap', 'ifrs', 'eps', 'ebitda', 'roi', 'roe', 'roa', 'pe', 'p/e',
            'aws', 'azure', 'gcp', 'ai', 'ml', 'iot', 'saas', 'paas', 'iaas'
        }

        # Company names (from our constants)
        from backend.config.constants import COMPANIES
        self.company_names = set(COMPANIES)

        # Financial metrics - single words that are highly important
        self.financial_metrics = {
            'revenue', 'income', 'profit', 'loss', 'earnings', 'expenses', 'costs',
            'assets', 'liabilities', 'equity', 'debt', 'cash', 'capital',
            'margin', 'ratio', 'growth', 'decline', 'increase', 'decrease',
            'million', 'billion', 'trillion', 'percent', 'percentage'
        }

    def tokenize(self, text: str) -> List[str]:
        """
        Tokenize text with proper handling for financial documents.

        Args:
            text: Input text

        Returns:
            List of tokens (lowercased, no stop words, financial terms preserved)
        """
        # Convert to lowercase but preserve structure
        text_lower = text.lower()

        # First, protect financial phrases by replacing spaces with underscores
        # This prevents them from being split
        protected_text = text_lower
        for phrase in self.financial_phrases:
            protected_text = protected_text.replace(
                phrase, phrase.replace(' ', '_'))

        # Remove special characters but keep numbers and financial symbols
        # Keep: letters, numbers, $, %, decimal points, underscores (for protected phrases)
        protected_text = re.sub(r'[^\w\s$%\._]', ' ', protected_text)

        # Split on whitespace
        tokens = protected_text.split()

        # Remove stop words and empty strings, but keep financial terms
        filtered_tokens = []
        for t in tokens:
            if not t:
                continue
            # Keep if not a stop word, or if it's a financial term
            if t not in self.stop_words or t in self.financial_metrics:
                # Restore underscores to spaces for phrases
                filtered_tokens.append(t.replace('_', ' '))

        # Flatten phrase tokens back to individual words for BM25
        final_tokens = []
        for token in filtered_tokens:
            if ' ' in token:
                # It's a protected phrase - add both the phrase and individual words
                final_tokens.append(token.replace(' ', '_')
                                    )  # Keep phrase as unit
                final_tokens.extend(token.split())  # Also add individual words
            else:
                final_tokens.append(token)

        return final_tokens

    def extract_phrases(self, text: str, min_length: int = 2, max_length: int = 3) -> List[str]:
        """
        Extract meaningful phrases from text, prioritizing financial phrases.

        Args:
            text: Input text
            min_length: Minimum phrase length in words
            max_length: Maximum phrase length in words

        Returns:
            List of phrases (financial phrases first, then general phrases)
        """
        text_lower = text.lower()
        phrases = []

        # First, extract known financial phrases (higher priority)
        for phrase in self.financial_phrases:
            if phrase in text_lower:
                phrases.append(phrase)

        # Then extract general phrases from tokens
        tokens = self.tokenize(text)
        # Filter out phrase markers (tokens with underscores)
        clean_tokens = [t.replace('_', ' ') for t in tokens if '_' not in t or t.replace(
            '_', ' ') in self.financial_phrases]

        for length in range(min_length, max_length + 1):
            for i in range(len(clean_tokens) - length + 1):
                phrase = ' '.join(clean_tokens[i:i + length])
                # Don't duplicate financial phrases we already added
                if phrase not in phrases:
                    phrases.append(phrase)

        return phrases

    def calculate_bm25_score(
        self,
        query_tokens: List[str],
        document_tokens: List[str],
        document_freq: Optional[Dict[str, int]] = None,
        total_documents: Optional[int] = None,
        avg_doc_length: float = 100.0,
        k1: float = 1.5,
        b: float = 0.75
    ) -> float:
        """
        Calculate BM25 score for a document given a query.

        Simplified BM25 formula:
        score = sum( IDF(term) * (f(term) * (k1 + 1)) / (f(term) + k1 * (1 - b + b * |doc|/avgdl)) )

        Args:
            query_tokens: Tokenized query
            document_tokens: Tokenized document
            document_freq: Document frequency of terms (for IDF calculation)
            total_documents: Total number of documents in corpus (for proper IDF calculation)
            avg_doc_length: Average document length
            k1: Term frequency saturation parameter
            b: Length normalization parameter

        Returns:
            BM25 score
        """
        if not query_tokens or not document_tokens:
            return 0.0

        doc_length = len(document_tokens)
        doc_token_counts = Counter(document_tokens)

        score = 0.0
        unique_query_terms = set(query_tokens)

        for term in unique_query_terms:
            if term not in doc_token_counts:
                continue

            # Term frequency in document
            tf = doc_token_counts[term]

            # Boost financial terms, company names, and years
            term_boost = 1.0
            clean_term = term.replace('_', ' ')

            if clean_term in self.financial_phrases:
                term_boost = 2.0  # Financial phrases are very important
            elif clean_term in self.financial_metrics:
                term_boost = 1.5  # Financial metrics are important
            elif clean_term in self.company_names:
                term_boost = 1.8  # Company names are very important
            elif clean_term in self.financial_abbreviations:
                term_boost = 1.5  # Financial abbreviations are important
            elif re.match(r'^\d{4}$', clean_term):  # Year (4 digits)
                term_boost = 1.3  # Years are moderately important

            # Inverse Document Frequency (IDF) calculation
            # Uses proper corpus statistics when available
            # IDF = log((N + 1) / (df + 1)) where N is total documents, df is document frequency
            if document_freq and term in document_freq and total_documents:
                df = document_freq[term]
                # Standard IDF formula with smoothing (prevents division by zero)
                # Higher IDF = term is rare and more informative
                idf = math.log((total_documents + 1.0) / (df + 1.0))
            elif document_freq and term in document_freq:
                # If we have document frequency but not total documents, estimate
                # Use the maximum document frequency as a proxy for total documents
                # This is a reasonable approximation when total_documents is unknown
                df = document_freq[term]
                estimated_total = max(document_freq.values(
                )) if document_freq.values() else max(df * 2, 10)
                idf = math.log((estimated_total + 1.0) / (df + 1.0))
            else:
                # If no corpus statistics available, use a reasonable default
                # This assumes the term appears in a moderate number of documents
                # Using log(10) ≈ 2.3 as a reasonable default for moderately common terms
                idf = math.log(10.0)

            # BM25 formula with term boost
            numerator = idf * tf * (k1 + 1) * term_boost
            denominator = tf + k1 * (1 - b + b * (doc_length / avg_doc_length))

            score += numerator / denominator

        return score

    def calculate_keyword_relevance(
        self,
        query: str,
        content: str,
        use_phrases: bool = True
    ) -> float:
        """
        Calculate keyword relevance score between query and content.

        Args:
            query: Query text
            content: Document content
            use_phrases: Whether to consider phrases in addition to single words

        Returns:
            Relevance score (0.0 to 1.0)
        """
        query_tokens = self.tokenize(query)
        content_tokens = self.tokenize(content)

        if not query_tokens:
            return 0.0

        # Calculate BM25-like score
        bm25_score = self.calculate_bm25_score(query_tokens, content_tokens)

        # Normalize to 0-1 range (rough approximation)
        # BM25 scores can vary, so we use a sigmoid-like normalization
        normalized_score = 1.0 / (1.0 + math.exp(-bm25_score / 10.0))

        # Also check for exact phrase matches (especially financial phrases)
        phrase_bonus = 0.0
        if use_phrases:
            query_phrases = self.extract_phrases(
                query, min_length=2, max_length=3)
            content_lower = content.lower()

            for phrase in query_phrases:
                if phrase in content_lower:
                    # Financial phrases get much higher bonus
                    if phrase in self.financial_phrases:
                        phrase_bonus += 0.3  # Significant boost for financial phrases
                    else:
                        # Longer phrases get higher bonus
                        phrase_bonus += len(phrase.split()) * 0.1

        # Combine scores
        final_score = min(1.0, normalized_score + phrase_bonus)

        return final_score

    def find_keyword_matches(
        self,
        query: str,
        content: str,
        min_score: float = 0.1
    ) -> Dict[str, float]:
        """
        Find and score keyword matches in content.

        Args:
            query: Query text
            content: Document content
            min_score: Minimum score to include

        Returns:
            Dictionary of matched terms/phrases and their scores
        """
        query_tokens = set(self.tokenize(query))
        # Tokenize for consistency, but we use content_lower for matching
        self.tokenize(content)
        content_lower = content.lower()

        matches = {}

        # Single word matches
        for token in query_tokens:
            if token in content_lower:
                # Count occurrences
                count = content_lower.count(token)
                # Score based on frequency (normalized)
                # Cap at 1.0 for 10+ occurrences
                score = min(1.0, count / 10.0)
                matches[token] = score

        # Phrase matches (higher weight)
        query_phrases = self.extract_phrases(query, min_length=2, max_length=3)
        for phrase in query_phrases:
            if phrase in content_lower:
                count = content_lower.count(phrase)
                score = min(1.0, count * 0.2)  # Phrases worth more
                matches[phrase] = score

        # Filter by min_score
        matches = {k: v for k, v in matches.items() if v >= min_score}

        return matches
