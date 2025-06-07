import { ContentTypeId, ContentCodec, EncodedContent, CodecRegistry } from '@xmtp/content-type-primitives';

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

  encode(content: InvestmentProposal, registry: CodecRegistry): EncodedContent {
    const bytes = new TextEncoder().encode(JSON.stringify(content));
    return {
      type: this.contentType,
      parameters: {},
      content: bytes,
    };
  }

  decode(encoded: EncodedContent, registry: CodecRegistry): InvestmentProposal {
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
    return true;
  }

  private isValidProposal(obj: any): obj is InvestmentProposal {
    return (
      obj &&
      typeof obj.id === 'string' &&
      typeof obj.title === 'string' &&
      typeof obj.description === 'string' &&
      typeof obj.amount === 'string' &&
      typeof obj.strategy === 'string' &&
      typeof obj.deadline === 'number' &&
      typeof obj.requiredVotes === 'number' &&
      typeof obj.proposedBy === 'string' &&
      typeof obj.timestamp === 'number'
    );
  }
}

export class InvestmentVoteCodec implements ContentCodec<InvestmentVote> {
  get contentType(): ContentTypeId {
    return ContentTypeInvestmentVote;
  }

  encode(content: InvestmentVote, registry: CodecRegistry): EncodedContent {
    const bytes = new TextEncoder().encode(JSON.stringify(content));
    return {
      type: this.contentType,
      parameters: {},
      content: bytes,
    };
  }

  decode(encoded: EncodedContent, registry: CodecRegistry): InvestmentVote {
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
    return true;
  }

  private isValidVote(obj: any): obj is InvestmentVote {
    return (
      obj &&
      typeof obj.proposalId === 'string' &&
      ['approve', 'reject', 'abstain'].includes(obj.vote) &&
      typeof obj.voterAddress === 'string' &&
      typeof obj.timestamp === 'number' &&
      (obj.votingPower === undefined || typeof obj.votingPower === 'number')
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