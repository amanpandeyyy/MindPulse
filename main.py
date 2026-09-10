
import joblib
import pandas as pd
from pathlib import Path
from typing import Literal
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI
from pydantic import BaseModel , Field

MODEL_PATH = Path(__file__).resolve().parent / "Mental_Health_model.pkl"
model = joblib.load(MODEL_PATH)
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#first pynadntic model
class studentData(BaseModel):
    Age: int =Field(..., ge = 0, le = 100)
    gender: Literal['Male', 'Female']
    Country: str
    Academic_Level: Literal['High School', 'Undergraduate', 'Graduate']
    Most_Used_Platform: Literal['Instagram', 'Facebook', 'Twitter', 'Snapchat', 'TikTok', 'LinkedIn', 'Whatsapp', 'Youtube', 'VKontakte', 'Reddit']
    Purpose_Of_Use: Literal['Networking', 'Entertainment', 'Education', 'News']
    Avg_Daily_Usage_Hours:float = Field(..., ge = 0, le = 24)
    Daily_Unlocks: int = Field(..., ge = 0)
    Study_Hours: float = Field(..., ge = 0, le = 24)
    Physical_Activity_Hours: float =Field(..., ge = 0, le = 24)
    Sleep_Hours_Per_Night: float = Field(..., ge = 0, le = 24)
    Stress_Level: Literal['Low', 'Medium', 'High','Very High']

# Describe what we send back
class PredictionResponse(BaseModel):
  predicted_mental_health_score: float

@app.get("/")
def greet():
 return {"message": "this is aman pandey"}

top_countries = [
'Other',
'India',
'USA',
'Canada',
'Australia',
'UK',
'Germany',
'Mexico',
'Turkey',
'France'
]
@app.post("/predict" ,response_model= PredictionResponse)
def predict(data : studentData):
 country_group = data.Country if data.Country in top_countries else 'Other'
 input_row = pd.DataFrame([ {
 'Age': data.Age,
 'Gender': data.gender,
 'Academic_Level': data.Academic_Level,
 'Most_Used_Platform': data.Most_Used_Platform,
 'Purpose_Of_Use': data.Purpose_Of_Use,
 'Avg_Daily_Usage_Hours': data.Avg_Daily_Usage_Hours,
 'Daily_Unlocks': data.Daily_Unlocks,
 'Study_Hours': data.Study_Hours,
 'Physical_Activity_Hours': data.Physical_Activity_Hours,
 'Sleep_Hours_Per_Night': data.Sleep_Hours_Per_Night,
 'Stress_Level': data.Stress_Level,
 'Grouped_country': country_group
   
 }])

 prediction = model.predict(input_row)[0]
 return PredictionResponse(predicted_mental_health_score= round(float(prediction) * 10, 1))