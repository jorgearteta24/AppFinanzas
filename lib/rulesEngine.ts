import type { AutoRule, Category, TransactionType } from './types';

export interface ClassificationResult {
  categoryId?: string;
  subcategoryId?: string;
  suggestedType?: TransactionType;
  matchedRule?: AutoRule;
  confidence: number;
}

export function applyClassificationRules(
  description: string,
  amount: number,
  accountId: string,
  rules: AutoRule[]
): ClassificationResult {
  const descriptionLower = description.toLowerCase();

  const activeRules = rules
    .filter(rule => rule.is_active && rule.rule_type === 'classification')
    .sort((a, b) => b.priority - a.priority);

  for (const rule of activeRules) {
    const keywords = rule.conditions.keywords || [];

    const keywordMatch = keywords.some(keyword =>
      descriptionLower.includes(keyword.toLowerCase())
    );

    if (!keywordMatch) continue;

    const amountMin = rule.conditions.amount_min;
    const amountMax = rule.conditions.amount_max;
    const accountIds = rule.conditions.account_ids;

    if (amountMin !== undefined && Math.abs(amount) < amountMin) continue;
    if (amountMax !== undefined && Math.abs(amount) > amountMax) continue;
    if (accountIds && accountIds.length > 0 && !accountIds.includes(accountId)) continue;

    const matchedKeywords = keywords.filter(keyword =>
      descriptionLower.includes(keyword.toLowerCase())
    );
    const confidence = Math.min(0.95, 0.5 + (matchedKeywords.length * 0.15));

    return {
      categoryId: rule.category_id,
      subcategoryId: rule.subcategory_id,
      suggestedType: rule.suggested_type,
      matchedRule: rule,
      confidence,
    };
  }

  return {
    confidence: 0,
  };
}

export function detectDuplicateTransactions(
  newTransaction: {
    transaction_date: string;
    amount: number;
    description: string;
    reference?: string;
    account_id: string;
  },
  existingTransactions: Array<{
    id: string;
    transaction_date: string;
    amount: number;
    description: string;
    reference?: string;
    account_id: string;
  }>
): Array<{
  transactionId: string;
  similarityScore: number;
  matchReason: {
    date_match: boolean;
    amount_match: boolean;
    description_similarity: number;
    reference_match: boolean;
    same_account: boolean;
  };
}> {
  const duplicates: Array<{
    transactionId: string;
    similarityScore: number;
    matchReason: {
      date_match: boolean;
      amount_match: boolean;
      description_similarity: number;
      reference_match: boolean;
      same_account: boolean;
    };
  }> = [];

  const newDate = new Date(newTransaction.transaction_date);

  for (const existing of existingTransactions) {
    const existingDate = new Date(existing.transaction_date);
    const daysDiff = Math.abs((newDate.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24));

    const dateMatch = daysDiff <= 2;
    if (!dateMatch) continue;

    const amountDiff = Math.abs(Math.abs(newTransaction.amount) - Math.abs(existing.amount));
    const amountMatch = amountDiff < 0.01;

    const descriptionSimilarity = calculateStringSimilarity(
      newTransaction.description.toLowerCase(),
      existing.description.toLowerCase()
    );

    const referenceSimilarity = newTransaction.reference && existing.reference
      ? calculateStringSimilarity(
          newTransaction.reference.toLowerCase(),
          existing.reference.toLowerCase()
        )
      : 0;

    const referenceMatch = referenceSimilarity > 0.8;
    const sameAccount = newTransaction.account_id === existing.account_id;

    let similarityScore = 0;
    if (dateMatch) similarityScore += 0.2;
    if (amountMatch) similarityScore += 0.3;
    if (sameAccount) similarityScore += 0.2;
    similarityScore += descriptionSimilarity * 0.2;
    similarityScore += referenceSimilarity * 0.1;

    if (similarityScore >= 0.6) {
      duplicates.push({
        transactionId: existing.id,
        similarityScore: Math.min(0.99, similarityScore),
        matchReason: {
          date_match: dateMatch,
          amount_match: amountMatch,
          description_similarity: descriptionSimilarity,
          reference_match: referenceMatch,
          same_account: sameAccount,
        },
      });
    }
  }

  return duplicates.sort((a, b) => b.similarityScore - a.similarityScore);
}

function calculateStringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;

  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function createAutoRule(
  name: string,
  keywords: string[],
  categoryId?: string,
  subcategoryId?: string,
  suggestedType?: TransactionType
): Partial<AutoRule> {
  return {
    name,
    rule_type: 'classification',
    category_id: categoryId,
    subcategory_id: subcategoryId,
    suggested_type: suggestedType,
    conditions: {
      keywords,
    },
    priority: 10,
    is_active: true,
    is_default: false,
    match_count: 0,
  };
}

export async function scanForDuplicates(
  userId: string,
  supabase: any
): Promise<number> {
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('transaction_date', { ascending: false })
    .limit(500);

  if (error || !transactions) {
    console.error('Error loading transactions for duplicate scan:', error);
    return 0;
  }

  let duplicatesFound = 0;

  for (let i = 0; i < transactions.length; i++) {
    const current = transactions[i];
    const remaining = transactions.slice(i + 1);

    const duplicates = detectDuplicateTransactions(current, remaining);

    for (const duplicate of duplicates) {
      const existingMatch = await supabase
        .from('duplicate_matches')
        .select('id')
        .eq('user_id', userId)
        .or(`and(transaction1_id.eq.${current.id},transaction2_id.eq.${duplicate.transactionId}),and(transaction1_id.eq.${duplicate.transactionId},transaction2_id.eq.${current.id})`)
        .maybeSingle();

      if (!existingMatch.data) {
        await supabase
          .from('duplicate_matches')
          .insert({
            user_id: userId,
            transaction1_id: current.id,
            transaction2_id: duplicate.transactionId,
            similarity_score: duplicate.similarityScore,
            match_reason: duplicate.matchReason,
            status: 'pending',
          });

        duplicatesFound++;
      }
    }
  }

  return duplicatesFound;
}
