import { ContentTypeId, ContentCodec, EncodedContent } from '@xmtp/content-type-primitives';

export interface InvestmentProposal {
  id: string;
  title: string;
  description: string;
  amount: string;
  strategy: string;
  deadline: number;
  requiredVotes: number;
  proposedBy: string;
  timestamp: number;
}

export interface InvestmentVote {
  proposalId: string;
  vote: 'approve' | 'reject' | 'abstain';
  voterAddress: string;
  timestamp: number;
  votingPower?: number;
}

// Create content type IDs with correct constructor signature
export const ContentTypeInvestmentProposal = new ContentTypeId({
  authorityId: 'echofi.app',
  typeId: 'investment-proposal',
  versionMajor: 1,
  versionMinor: 0,
});

export const ContentTypeInvestmentVote = new ContentTypeId({
  authorityId: 'echofi.app',
  typeId: 'investment-vote',
  versionMajor: 1,
  versionMinor: 0,
});

export class InvestmentProposalCodec implements ContentCodec<InvestmentProposal> {
  get contentType(): ContentTypeId {
    return ContentTypeInvestmentProposal;
  }

  encode(content: InvestmentProposal): EncodedContent {
    const bytes = new TextEncoder().encode(JSON.stringify(content));
    return {
      type: this.contentType,
      parameters: {},
      content: bytes,
    };
  }

  decode(encoded: EncodedContent): InvestmentProposal {
    const decoded = JSON.parse(new TextDecoder().decode(encoded.content));
    if (!this.isValidProposal(decoded)) {
      throw new Error('Invalid investment proposal format');
    }
    return decoded;
  }

  fallback(content: InvestmentProposal): string {
    return `Investment Proposal: ${content.title} - ${content.amount} (${content.strategy})`;
  }

  shouldPush(content: InvestmentProposal): boolean {
    if(content) {
      return true;
    }
    return true;
  }

  private isValidProposal(obj: unknown): obj is InvestmentProposal {
    if (!obj || typeof obj !== 'object') return false;
    
    const proposal = obj as Record<string, unknown>;
    return (
      typeof proposal.id === 'string' &&
      typeof proposal.title === 'string' &&
      typeof proposal.description === 'string' &&
      typeof proposal.amount === 'string' &&
      typeof proposal.strategy === 'string' &&
      typeof proposal.deadline === 'number' &&
      typeof proposal.requiredVotes === 'number' &&
      typeof proposal.proposedBy === 'string' &&
      typeof proposal.timestamp === 'number'
    );
  }
}

export class InvestmentVoteCodec implements ContentCodec<InvestmentVote> {
  get contentType(): ContentTypeId {
    return ContentTypeInvestmentVote;
  }

  encode(content: InvestmentVote): EncodedContent {
    const bytes = new TextEncoder().encode(JSON.stringify(content));
    return {
      type: this.contentType,
      parameters: {},
      content: bytes,
    };
  }

  decode(encoded: EncodedContent): InvestmentVote {
    const decoded = JSON.parse(new TextDecoder().decode(encoded.content));
    if (!this.isValidVote(decoded)) {
      throw new Error('Invalid investment vote format');
    }
    return decoded;
  }

  fallback(content: InvestmentVote): string {
    return `Vote: ${content.vote} for proposal ${content.proposalId}`;
  }

  shouldPush(content: InvestmentVote): boolean {
    if(content) {
      return true;
    }
    return true;
  }

  private isValidVote(obj: unknown): obj is InvestmentVote {
    if (!obj || typeof obj !== 'object') return false;
    
    const vote = obj as Record<string, unknown>;
    return (
      typeof vote.proposalId === 'string' &&
      ['approve', 'reject', 'abstain'].includes(vote.vote as string) &&
      typeof vote.voterAddress === 'string' &&
      typeof vote.timestamp === 'number' &&
      (vote.votingPower === undefined || typeof vote.votingPower === 'number')
    );
  }
}

// Helper functions for creating content
export function createInvestmentProposal(
  title: string,
  description: string,
  amount: string,
  strategy: string,
  deadline: number,
  requiredVotes: number,
  proposedBy: string
): InvestmentProposal {
  return {
    id: generateProposalId(),
    title,
    description,
    amount,
    strategy,
    deadline,
    requiredVotes,
    proposedBy,
    timestamp: Date.now(),
  };
}

export function createInvestmentVote(
  proposalId: string,
  vote: 'approve' | 'reject' | 'abstain',
  voterAddress: string,
  votingPower?: number
): InvestmentVote {
  return {
    proposalId,
    vote,
    voterAddress,
    timestamp: Date.now(),
    votingPower,
  };
}

// Helper function to generate unique proposal IDs
function generateProposalId(): string {
  return `proposal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Export codec instances for easy registration
export const investmentProposalCodec = new InvestmentProposalCodec();
export const investmentVoteCodec = new InvestmentVoteCodec();