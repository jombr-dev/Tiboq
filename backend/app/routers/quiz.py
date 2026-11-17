from fastapi import APIRouter, Depends

from app.dependencies import unlocked
from app.schemas import QuizInput
from app.services.quiz import generate

router = APIRouter(prefix='/api')


@router.post('/quiz/generate')
async def generate_quiz(body: QuizInput, vault=Depends(unlocked)):
    return await generate(vault, body, vault.token)
