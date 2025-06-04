# streamlit_app.py

import streamlit as st
import requests
import pandas as pd
import time
import streamlit.components.v1 as components
import plotly.graph_objs as go

BACKEND_BASE = "http://localhost:8000"

st.set_page_config(page_title="Voice Agent Call System", layout="wide")

st.title("📞 Voice Agent Call System")
st.markdown("Upload borrower CSV, initiate calls, and view live transcript + latency.")

# Step 1: Upload CSV
with st.sidebar:
    st.header("📁 Upload Borrower CSV")
    uploaded_file = st.file_uploader("Choose borrower.csv", type="csv")
    if uploaded_file:
        res = requests.post(f"{BACKEND_BASE}/upload", files={"file": uploaded_file})
        if res.status_code == 200:
            st.success("Uploaded successfully!")
        else:
            st.error(f"Upload failed: {res.json().get('error')}")

# Step 2: Show Borrowers
if st.button("📊 Load Borrowers"):
    res = requests.get(f"{BACKEND_BASE}/borrowers")
    if res.status_code == 200:
        borrowers = res.json()
        df = pd.DataFrame(borrowers)
        st.dataframe(df)
        st.session_state["borrowers"] = borrowers
    else:
        st.error("Could not load borrower data.")

# Step 3: Select borrower and start call
if "borrowers" in st.session_state:
    st.subheader("Select a borrower to call")

    selected = st.selectbox(
        "Choose borrower",
        options=st.session_state["borrowers"],
        format_func=lambda b: f"{b['F_Name']} {b['L_Name']} - {b['Mobile_No']}"
    )

    if selected:
        col1, col2 = st.columns(2)
        with col1:
            st.write(f"**Name**: {selected['F_Name']} {selected['L_Name']}")
            st.write(f"**Phone**: {selected['Mobile_No']}")
            st.write(f"**Loan Amount**: ₹{selected['Current_balance']}")
            st.write(f"**Installment**: ₹{selected['Installment_Amount']}")
        with col2:
            st.write(f"**Last Payment**: {selected.get('Date_of_last_payment', 'NA')}")
            channel = selected.get("Channel_Preference", "").strip().lower()
            st.write(f"**Preference**: {channel.capitalize()}")

        # Show call button if preference is call/voice
        valid_voice = channel in ["call", "voice"]

        if valid_voice:
            call_btn = st.button("📞 Start Voice Call")
            if call_btn:
                res = requests.post(
                    f"{BACKEND_BASE}/start-call",
                    json={"phone": str(selected["Mobile_No"])}
                )
                if res.ok:
                    st.success("Call initiated!")
                    st.session_state["calling"] = True
                    st.session_state["latency_data"] = []
                else:
                    st.error(f"Call failed: {res.json().get('error')}")
        else:
            st.warning("This borrower does not prefer voice/call channel.")

# Step 4: Live Transcript + Latency (if call started)
if st.session_state.get("calling"):
    st.subheader("📡 Live Call Monitoring")

    col1, col2 = st.columns([2, 1])
    with col1:
        st.markdown("### 🎤 Transcript")
        transcript_box = st.empty()

        transcript_lines = []
        with requests.get(f"{BACKEND_BASE}/transcript", stream=True) as r:
            for line in r.iter_lines():
                if line and line.startswith(b"data: "):
                    text = line.replace(b"data: ", b"").decode("utf-8")
                    transcript_lines.append(text)
                    transcript_box.markdown("\n\n".join(transcript_lines[-10:]))
                    time.sleep(0.5)
                if len(transcript_lines) >= 50:
                    break

    with col2:
        st.markdown("### 📈 Latency Distribution")
        latency_plot = st.empty()
        try:
            res = requests.get(f"{BACKEND_BASE}/latency")
            latency = res.json()
            fig = go.Figure()
            fig.add_trace(go.Scatter(x=latency["timestamps"], y=latency["latency_ms"], mode='lines+markers'))
            fig.update_layout(title="Latency (ms)", xaxis_title="Time", yaxis_title="Latency")
            latency_plot.plotly_chart(fig, use_container_width=True)
        except:
            st.warning("Latency data not available yet.")
