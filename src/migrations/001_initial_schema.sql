-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Investment Groups table
CREATE TABLE investment_groups (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name TEXT NOT NULL,
    description TEXT,
    xmtp_group_id TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_funds DECIMAL(18, 6) DEFAULT 0,
    member_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true
);

-- Group Members table
CREATE TABLE group_members (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    group_id TEXT REFERENCES investment_groups(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    contributed_amount DECIMAL(18, 6) DEFAULT 0,
    voting_power DECIMAL(5, 2) DEFAULT 1.0,
    is_active BOOLEAN DEFAULT true,
    UNIQUE(group_id, wallet_address)
);

-- Proposals table
CREATE TABLE proposals (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    group_id TEXT REFERENCES investment_groups(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    strategy TEXT NOT NULL,
    requested_amount DECIMAL(18, 6) NOT NULL,
    proposed_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'approved', 'rejected', 'executed')),
    approval_votes INTEGER DEFAULT 0,
    rejection_votes INTEGER DEFAULT 0,
    required_votes INTEGER NOT NULL
);

-- Votes table
CREATE TABLE votes (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    proposal_id TEXT REFERENCES proposals(id) ON DELETE CASCADE,
    voter_address TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('approve', 'reject', 'abstain')),
    voting_power DECIMAL(5, 2) DEFAULT 1.0,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(proposal_id, voter_address)
);

-- Create indexes for better performance
CREATE INDEX idx_investment_groups_created_by ON investment_groups(created_by);
CREATE INDEX idx_investment_groups_xmtp_group_id ON investment_groups(xmtp_group_id);
CREATE INDEX idx_group_members_wallet_address ON group_members(wallet_address);
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_proposals_group_id ON proposals(group_id);
CREATE INDEX idx_proposals_proposed_by ON proposals(proposed_by);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_deadline ON proposals(deadline);
CREATE INDEX idx_votes_proposal_id ON votes(proposal_id);
CREATE INDEX idx_votes_voter_address ON votes(voter_address);

-- Create view for group analytics
CREATE VIEW group_analytics AS
SELECT 
    ig.id,
    ig.name,
    ig.total_funds,
    ig.member_count,
    COUNT(p.id) as total_proposals,
    COUNT(CASE WHEN p.status = 'active' THEN 1 END) as active_proposals,
    COUNT(CASE WHEN p.status = 'approved' THEN 1 END) as approved_proposals,
    COUNT(CASE WHEN p.status = 'executed' THEN 1 END) as executed_proposals
FROM investment_groups ig
LEFT JOIN proposals p ON ig.id = p.group_id
GROUP BY ig.id, ig.name, ig.total_funds, ig.member_count;

-- Create view for proposal details with vote counts
CREATE VIEW proposal_details AS
SELECT 
    p.*,
    COUNT(v.id) as total_votes,
    COUNT(CASE WHEN v.vote = 'approve' THEN 1 END) as approve_count,
    COUNT(CASE WHEN v.vote = 'reject' THEN 1 END) as reject_count,
    COUNT(CASE WHEN v.vote = 'abstain' THEN 1 END) as abstain_count,
    SUM(CASE WHEN v.vote = 'approve' THEN v.voting_power ELSE 0 END) as approve_power,
    SUM(CASE WHEN v.vote = 'reject' THEN v.voting_power ELSE 0 END) as reject_power
FROM proposals p
LEFT JOIN votes v ON p.id = v.proposal_id
GROUP BY p.id;

-- Create function to update vote counts when votes are inserted
CREATE OR REPLACE FUNCTION update_proposal_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE proposals SET
            approval_votes = (
                SELECT COUNT(*) FROM votes 
                WHERE proposal_id = NEW.proposal_id AND vote = 'approve'
            ),
            rejection_votes = (
                SELECT COUNT(*) FROM votes 
                WHERE proposal_id = NEW.proposal_id AND vote = 'reject'
            )
        WHERE id = NEW.proposal_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE proposals SET
            approval_votes = (
                SELECT COUNT(*) FROM votes 
                WHERE proposal_id = OLD.proposal_id AND vote = 'approve'
            ),
            rejection_votes = (
                SELECT COUNT(*) FROM votes 
                WHERE proposal_id = OLD.proposal_id AND vote = 'reject'
            )
        WHERE id = OLD.proposal_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic vote count updates
CREATE TRIGGER trigger_update_proposal_vote_counts
    AFTER INSERT OR DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_proposal_vote_counts();

-- Create function to update member count when members are added/removed
CREATE OR REPLACE FUNCTION update_group_member_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE investment_groups SET
            member_count = (
                SELECT COUNT(*) FROM group_members 
                WHERE group_id = NEW.group_id AND is_active = true
            )
        WHERE id = NEW.group_id;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE investment_groups SET
            member_count = (
                SELECT COUNT(*) FROM group_members 
                WHERE group_id = NEW.group_id AND is_active = true
            )
        WHERE id = NEW.group_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE investment_groups SET
            member_count = (
                SELECT COUNT(*) FROM group_members 
                WHERE group_id = OLD.group_id AND is_active = true
            )
        WHERE id = OLD.group_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic member count updates
CREATE TRIGGER trigger_update_group_member_count
    AFTER INSERT OR UPDATE OR DELETE ON group_members
    FOR EACH ROW
    EXECUTE FUNCTION update_group_member_count();