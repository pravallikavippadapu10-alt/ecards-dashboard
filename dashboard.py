from datetime import date, timedelta

import mysql.connector
import pandas as pd
import streamlit as st


DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 3306,
    "user": "root",
    "password": "",
    "database": "hhcl_ecards_2_0",
}


@st.cache_data(ttl=60)
def load_posters() -> pd.DataFrame:
    connection = mysql.connector.connect(**DB_CONFIG)
    try:
        query = """
            SELECT GEN_POSTER_ID, GEN_POSTER_CREATED_TS, CAMPAIGN_NAME,
                   CARD_NAME, REGION, EMPLOYEE_NAME, DOCTOR_NAME,
                   CARD_TYPE, GEN_POSTER_STATUS
            FROM generated_poster
            ORDER BY GEN_POSTER_CREATED_TS DESC
        """
        return pd.read_sql(query, connection)
    finally:
        connection.close()


@st.cache_data(ttl=60)
def load_counts() -> tuple[int, int, int]:
    connection = mysql.connector.connect(**DB_CONFIG)
    try:
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) FROM master_campaigns")
        campaigns = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM cardlist WHERE CARD_STATUS = 1")
        active_cards = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM generated_poster")
        posters = cursor.fetchone()[0]
        return campaigns, active_cards, posters
    finally:
        cursor.close()
        connection.close()


st.set_page_config(page_title="HHCL eCards Analytics", page_icon="📊", layout="wide")
st.markdown(
    """
    <style>
    [data-testid="stMetricValue"] { color: #0f766e; }
    [data-testid="stSidebar"] { background: #f1f5f2; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("HHCL eCards Analytics")
st.caption("Live activity from the XAMPP MySQL database")

try:
    posters = load_posters()
    campaign_count, active_cards, poster_count = load_counts()
except mysql.connector.Error as error:
    st.error(f"Could not connect to XAMPP MySQL: {error}")
    st.stop()

posters["GEN_POSTER_CREATED_TS"] = pd.to_datetime(posters["GEN_POSTER_CREATED_TS"])
valid_dates = posters["GEN_POSTER_CREATED_TS"].dropna()
default_start = (valid_dates.min().date() if not valid_dates.empty else date.today() - timedelta(days=30))
default_end = (valid_dates.max().date() if not valid_dates.empty else date.today())

with st.sidebar:
    st.header("Filters")
    selected_campaign = st.selectbox(
        "Campaign",
        ["All campaigns"] + sorted(posters["CAMPAIGN_NAME"].dropna().unique().tolist()),
    )
    selected_dates = st.date_input("Created between", value=(default_start, default_end))
    if len(selected_dates) == 2:
        start_date, end_date = selected_dates
    else:
        start_date, end_date = default_start, default_end

filtered = posters[
    posters["GEN_POSTER_CREATED_TS"].dt.date.between(start_date, end_date)
]
if selected_campaign != "All campaigns":
    filtered = filtered[filtered["CAMPAIGN_NAME"] == selected_campaign]

col1, col2, col3, col4 = st.columns(4)
col1.metric("Generated posters", f"{len(filtered):,}")
col2.metric("Unique doctors", f"{filtered["DOCTOR_NAME"].nunique():,}")
col3.metric("Campaigns", f"{campaign_count:,}")
col4.metric("Active cards", f"{active_cards:,}")

left, right = st.columns(2)
with left:
    st.subheader("Poster activity")
    daily = (
        filtered.dropna(subset=["GEN_POSTER_CREATED_TS"])
        .assign(Date=lambda frame: frame["GEN_POSTER_CREATED_TS"].dt.date)
        .groupby("Date")
        .size()
        .rename("Posters")
    )
    st.line_chart(daily)
with right:
    st.subheader("Posters by region")
    by_region = filtered["REGION"].fillna("Unknown").value_counts().head(12)
    st.bar_chart(by_region)

st.subheader("Top campaigns")
st.bar_chart(filtered["CAMPAIGN_NAME"].fillna("Unknown").value_counts().head(10))

st.subheader("Filtered poster records")
display_columns = [
    "GEN_POSTER_CREATED_TS", "CAMPAIGN_NAME", "CARD_NAME", "REGION",
    "EMPLOYEE_NAME", "DOCTOR_NAME", "CARD_TYPE", "GEN_POSTER_STATUS",
]
st.dataframe(filtered[display_columns], use_container_width=True, hide_index=True)
st.download_button(
    "Download filtered CSV",
    filtered.to_csv(index=False).encode("utf-8"),
    "hhcl_ecards_filtered_posters.csv",
    "text/csv",
)