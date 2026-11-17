import asyncio

import pytest

from app.schemas import QuizDraft, QuizInput
from app.services import llm
from app.services.quiz import _check_draft, _passages, _validate_or_repair, generate


SOURCE = 'Chest pain history should record onset, location, duration, and associated symptoms.'


def draft(**changes):
    values = {
        'question': 'Which detail should a chest pain history record?',
        'options': ['onset', 'shoe size', 'birthplace', 'favorite color'],
        'answer_index': 0,
        'explanation': 'The passage lists onset.',
        'evidence_quote': 'record onset, location, duration',
    }
    values.update(changes)
    return QuizDraft(**values)


def test_quiz_requires_exact_answer_evidence_and_distinct_options():
    assert _check_draft(draft(), SOURCE).answer_index == 0
    with pytest.raises(llm.ModelValidationError):
        _check_draft(draft(options=['unknown', 'shoe size', 'birthplace', 'favorite color']), SOURCE)
    with pytest.raises(llm.ModelValidationError):
        _check_draft(draft(options=['onset', 'onset', 'birthplace', 'favorite color']), SOURCE)
    with pytest.raises(llm.ModelValidationError):
        _check_draft(draft(evidence_quote='record an ECG immediately'), SOURCE)
    with pytest.raises(llm.ModelValidationError):
        _check_draft(draft(question='Which organization provides information about chronic pain?',
                          options=['American Chronic Pain Association', 'shoe size', 'birthplace', 'favorite color'],
                          evidence_quote='American Chronic Pain Association (ACPA) 913-991-4740'),
                     'Headache. American Chronic Pain Association (ACPA) 913-991-4740', 'headache')


def test_easy_question_recovers_when_model_paraphrases_the_correct_option():
    source = 'A headache diary can help identify patterns and triggers.'
    item = draft(question='What can a headache diary help identify?',
                 options=['patterns over time', 'shoe size', 'birthplace', 'favorite color'],
                 evidence_quote=source)
    fixed = _validate_or_repair(item, source, 'headache', 'easy')
    assert fixed.options[0] == source
    with pytest.raises(llm.ModelValidationError):
        _validate_or_repair(item, source, 'headache', 'hard')


def test_quiz_attaches_source_without_requiring_model_to_copy_it():
    item = QuizDraft(question='Which detail does the chest pain history record?',
                     options=['onset', 'shoe size', 'birthplace', 'favorite color'], answer_index=0)
    fixed = _validate_or_repair(item, SOURCE, 'chest pain', 'easy')
    assert fixed.evidence_quote == SOURCE


def test_easy_question_replaces_another_source_supported_option():
    source = 'Headache notes record the date of each episode.'
    corpus = source + ' Headache notes record the start time of each episode.'
    item = draft(question='What do the headache notes record?',
                 options=['the date of each episode', 'the start time of each episode',
                          'birthplace', 'favorite color'], evidence_quote=source)
    fixed = _validate_or_repair(item, source, 'headache', 'easy', corpus)
    assert fixed.options[1] == 'shoe size'
    with pytest.raises(llm.ModelValidationError):
        _validate_or_repair(item, source, 'headache', 'medium', corpus)


def test_quiz_generates_multiple_questions_from_one_selected_source(monkeypatch):
    source = ' '.join(f'Asthma fact {n} is trigger {n}.' for n in range(1, 11))
    chunk = {'id': 'c1', 'document_id': 'd1', 'tag': 'notes', 'filename': 'notes.txt',
             'text': source, 'page': 1, 'heading': 'Asthma',
             'embedding': [1.0, 0.0], 'embedding_model': llm.EMBEDDING_PROFILE}

    class Vault:
        index = [chunk]
        auto_lock_minutes = 5
        def authorize(self, token, touch=False):
            assert token == 'session'

    async def fake_embed(topic):
        assert topic == 'asthma'
        return [1.0, 0.0]

    async def fake_generate(prompt, schema, validator_extra, **kwargs):
        passage = kwargs['data']['source']
        number = int(passage.split('fact ')[1].split()[0])
        question = draft(question=f'Which trigger is stated for asthma fact {number}?',
                         options=[f'trigger {number}', 'shoe size', 'birthplace', 'favorite color'],
                         evidence_quote=f'Asthma fact {number} is trigger {number}')
        return llm.ValidatedGeneration(validator_extra(question), {})

    monkeypatch.setattr(llm, 'embed_query', fake_embed)
    monkeypatch.setattr(llm, 'generate_validated', fake_generate)
    result = asyncio.run(generate(Vault(), QuizInput(topic='asthma', count=10,
        difficulty='easy', scope=['notes'], document_ids=['d1']), 'session'))
    assert result['generated'] == 10
    assert result['questions'][0]['answer_index'] == 0
    assert result['questions'][0]['citation']['quote'] == 'Asthma fact 1 is trigger 1.'
    assert not result['notice']


def test_passages_do_not_include_unrelated_contact_line():
    chunk = {'text': 'Headache patterns may be recorded in a diary. Call the American Chronic Pain Association at 913-991-4740.'}
    passages = _passages([chunk], 'headache')
    assert len(passages) == 1
    assert passages[0][1].startswith('Headache patterns')


def test_quiz_can_ask_two_different_facts_from_one_passage(monkeypatch):
    source = 'Asthma care records symptoms and triggers.'
    chunk = {'id': 'c1', 'document_id': 'd1', 'tag': 'notes', 'filename': 'notes.txt',
             'text': source, 'page': 1, 'heading': 'Asthma',
             'embedding': [1.0, 0.0], 'embedding_model': llm.EMBEDDING_PROFILE}

    class Vault:
        index = [chunk]
        auto_lock_minutes = 5
        def authorize(self, token, touch=False):
            pass

    async def fake_embed(topic):
        return [1.0, 0.0]

    async def fake_generate(prompt, schema, validator_extra, **kwargs):
        prior = kwargs['data']['already_asked']
        answer = 'triggers' if prior else 'symptoms'
        item = draft(question='Which detail do the asthma care notes record?',
                     options=[answer, 'shoe size', 'birthplace', 'favorite color'],
                     evidence_quote=source)
        return llm.ValidatedGeneration(validator_extra(item), {})

    monkeypatch.setattr(llm, 'embed_query', fake_embed)
    monkeypatch.setattr(llm, 'generate_validated', fake_generate)
    result = asyncio.run(generate(Vault(), QuizInput(topic='asthma', count=2,
        difficulty='easy', scope=['notes']), 'session'))
    assert result['generated'] == 2
