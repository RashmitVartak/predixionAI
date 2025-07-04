import os
import json
import pandas as pd
import firebase_admin
from firebase_admin import credentials, firestore

import RAGer as rag

class UserData:
    def __init__(self):
        self.dir_path = os.path.join(os.path.dirname(os.path.abspath(__file__)),'user_files')
        self.file_path = ''
        self.Data = None
        self.important_fields = [
            'F_Name', 'L_Name', "Gender", 'Mobile_No', "Income", 'Bureau_score',
            "Loan_amount", "Loan_type", "Interest_Rate", 'Interest', 'Loan_Processing_Fee', "Current_balance",
            "Installment_Amount",
            'Disbursal_Date', "Repayment_Start_Date", "Repayment_tenure", "Date_of_last_payment", 'Repayment_mode',
            "No_of_late_payments"
        ]

    def read_file(self,file_name):
        self.file_path = os.path.join(self.dir_path, file_name)
        self.file_extension = os.path.splitext(self.file_path)[1]
        if self.file_extension == '.csv':
            try:
                self.Data = pd.read_csv(self.file_path)
            except FileNotFoundError as e:
                print(f"I dont think the file '{file_name}' exists. Did you add it in the 'user_files' directory?")

        elif self.file_extension == '.pdf':
            docs = rag.load_dir(self.file_path)
            ids, texts, metadata = rag.chunking(docs)
            rag.embed_chunks(ids, texts, metadata)
            self.Data = "Data is Vectorized. Use fetch_info(query) method to get data."

        else:
            print("Currently only 'csv' and 'pdf' files can be read")

    def fetch_user(self,phone_no):
        try:
            if int(phone_no) in self.Data['Mobile_No'].values:
                user_data = self.Data.loc[self.Data['Mobile_No'] == phone_no][self.important_fields]
                user_info = {
                    "first_name": user_data['F_Name'].item(),
                    "last_name": user_data['L_Name'].item(),
                    "phone_no": user_data['Mobile_No'].item(),
                    "gender": user_data['Gender'].item(),
                    "income_in_inr": user_data['Income'].item(),
                    "credit_score": user_data['Bureau_score'].item(),
                    "loan_type": user_data['Loan_type'].item(),
                    "loan_amount": user_data['Loan_amount'].item(),
                    "interest_rate": user_data['Interest_Rate'].item(),
                    "process_fee": user_data['Loan_Processing_Fee'].item(),
                    "installment": user_data['Installment_Amount'].item(),
                    "start_date": user_data['Repayment_Start_Date'].item(),
                    "tenure": user_data['Repayment_tenure'].item(),
                    "balance_to_pay": user_data['Current_balance'].item(),
                    "payment_mode": user_data['Repayment_mode'].item(),
                    "late_payment": user_data['No_of_late_payments'].item(),
                    "last_date": user_data['Date_of_last_payment'].item()
                }
                return user_info
            else:
                print('User does not exist.')
                return {"Error": "User does not exist."}
        except (KeyError,TypeError) as e:
            print('Such a Phone Number does not exist in the File.')

    def fetch_info(self,query):
        result = rag.fetch_query(query)
        return result

class Database:
    def __init__(self):
        self.cred = credentials.Certificate("./conversational-ai-ab55c-firebase-adminsdk-fbsvc-e19783f081.json")
        try:
            firebase_admin.initialize_app(self.cred)
        except ValueError as e:
            print('Firebase App already Initialized')
        self.db = firestore.client()

    def init_user(self,phone: str, wa_id=None, chat_id=None, name=None):
        doc_ref = self.db.collection("testing").document(phone)
        if not doc_ref.get().exists:
            data = {
                "whatsapp_id": wa_id,
                "id": chat_id,
                "phone": phone,
                "name": name,
                "whatsapp_messages": [],
                "call_transcripts": []
            }
            self.db.collection("testing").document(phone).set(data)

        return self.db.collection("testing").document(phone)

    def payload(self, name: str, text, time):
        msg = {
            f"{name}": str(text),
            "timestamp": time
        }
        return msg

    def add_convo(self, ref, agent, msg):
        if agent == 'voice':
            ref.update({"call_transcripts": firestore.ArrayUnion([msg])})
        elif agent == 'whatsapp':
            ref.update({"whatsapp_messages": firestore.ArrayUnion([msg])})
        else:
            raise Exception('Invalid Agent')

    def get_convo(self, ref, agent):
        if agent == 'voice':
            conversation = ref.get().to_dict()['call_transcripts']
        elif agent == 'whatsapp':
            conversation = ref.get().to_dict()['whatsapp_messages']
        else:
            raise Exception('Invalid Agent')

        for msg in conversation:
            if 'timestamp' in msg:
                del msg['timestamp']

        latest_conversation = conversation[-5:]  # Slicing the list
        return latest_conversation