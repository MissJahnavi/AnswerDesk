CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'member',

    reputation INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT user_role_check
        CHECK (role IN ('member', 'agent', 'admin'))
);



CREATE TABLE questions (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,

    accepted_answer_id BIGINT,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_question_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
);




CREATE TABLE answers (
    id BIGSERIAL PRIMARY KEY,

    question_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,

    body TEXT NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_answer_question
        FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_answer_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);




ALTER TABLE questions
ADD CONSTRAINT fk_question_accepted_answer
FOREIGN KEY (accepted_answer_id)
REFERENCES answers(id)
ON DELETE SET NULL;


CREATE TABLE tags (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(50) UNIQUE NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE question_tags (
    question_id BIGINT NOT NULL,
    tag_id BIGINT NOT NULL,

    PRIMARY KEY (question_id, tag_id),

    CONSTRAINT fk_question_tag_question
        FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_question_tag_tag
        FOREIGN KEY (tag_id)
        REFERENCES tags(id)
        ON DELETE CASCADE
);


CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    question_id BIGINT,
    answer_id BIGINT,

    body TEXT NOT NULL,

    CONSTRAINT fk_comment_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_comment_question
        FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_comment_answer
        FOREIGN KEY (answer_id)
        REFERENCES answers(id)
        ON DELETE CASCADE,

    CONSTRAINT comment_target_check
        CHECK (
            (question_id IS NOT NULL AND answer_id IS NULL)
            OR
            (question_id IS NULL AND answer_id IS NOT NULL)
        )
);

CREATE TABLE votes (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL,

    question_id BIGINT,
    answer_id BIGINT,

    vote_type VARCHAR(10) NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,


    CONSTRAINT fk_vote_question
        FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_vote_answer
        FOREIGN KEY (answer_id)
        REFERENCES answers(id)
        ON DELETE CASCADE,

    CONSTRAINT vote_target_check
        CHECK (
            (question_id IS NOT NULL AND answer_id IS NULL)
            OR
            (question_id IS NULL AND answer_id IS NOT NULL)
        ),

    CONSTRAINT vote_type_check
        CHECK (
            vote_type IN ('upvote', 'downvote')
        )
);


CREATE UNIQUE INDEX unique_question_vote
ON votes (user_id, question_id)
WHERE question_id IS NOT NULL;



CREATE TABLE sla_policies (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL UNIQUE,

    priority VARCHAR(20) NOT NULL,

    response_time_minutes INTEGER NOT NULL,
    resolution_time_minutes INTEGER NOT NULL,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT sla_priority_check
        CHECK (
            priority IN ('low', 'medium', 'high', 'critical')
        ),

    CONSTRAINT sla_response_time_check
        CHECK (response_time_minutes > 0),

    CONSTRAINT sla_resolution_time_check
        CHECK (resolution_time_minutes > 0)
);


CREATE TABLE tickets (
    id BIGSERIAL PRIMARY KEY,

    requester_id BIGINT NOT NULL,
    assignee_id BIGINT,

    question_id BIGINT,

    sla_policy_id BIGINT NOT NULL,

    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    priority VARCHAR(20) NOT NULL DEFAULT 'medium',

    status VARCHAR(30) NOT NULL DEFAULT 'open',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ticket_requester
        FOREIGN KEY (requester_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ticket_assignee
        FOREIGN KEY (assignee_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_ticket_question
        FOREIGN KEY (question_id)
        REFERENCES questions(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_ticket_sla_policy
        FOREIGN KEY (sla_policy_id)
        REFERENCES sla_policies(id)
        ON DELETE RESTRICT,

    CONSTRAINT ticket_priority_check
        CHECK (
            priority IN ('low', 'medium', 'high', 'critical')
        ),

    CONSTRAINT ticket_status_check
        CHECK (
            status IN (
                'open',
                'closed'
            )
        )
);


CREATE TABLE ticket_events (
    id BIGSERIAL PRIMARY KEY,

    ticket_id BIGINT NOT NULL,
    actor_id BIGINT,

    event_type VARCHAR(50) NOT NULL,

    metadata JSONB,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_ticket_event_ticket
        FOREIGN KEY (ticket_id)
        REFERENCES tickets(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_ticket_event_actor
        FOREIGN KEY (actor_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);