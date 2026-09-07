from datetime import date, datetime
import os

from flask import Flask, jsonify, render_template
import mysql.connector


app = Flask(__name__)

DB_CONFIG = {
    "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
    "port": int(os.getenv("MYSQL_PORT", "3306")),
    "user": os.getenv("MYSQL_USER", "root"),
    "password": os.getenv("MYSQL_PASSWORD", ""),
    "database": os.getenv("MYSQL_DATABASE", "hhcl_ecards_2_0"),
}


def json_value(value):
    if isinstance(value, datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    return value


@app.get("/")
def index():
    return render_template("index.html")


@app.errorhandler(mysql.connector.Error)
def handle_database_error(error):
    return jsonify({"error": f"Database error: {error.msg}"}), 503


@app.get("/api/dashboard")
def dashboard_data():
    connection = mysql.connector.connect(**DB_CONFIG)
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute(
            """
                 SELECT GEN_POSTER_ID, GEN_POSTER_CREATED_TS, CAMPAIGN_NAME,
                   CARD_NAME, REGION, EMPLOYEE_NAME, DOCTOR_NAME,
                     CARD_TYPE, GEN_POSTER_STATUS, DIVISION_ID
            FROM generated_poster
            ORDER BY GEN_POSTER_CREATED_TS DESC
            """
        )
        posters = [
            {key: json_value(value) for key, value in row.items()}
            for row in cursor.fetchall()
        ]
        cursor.execute("SELECT COUNT(*) AS total FROM master_campaigns")
        campaigns = cursor.fetchone()["total"]
        cursor.execute("SELECT COUNT(*) AS total FROM cardlist WHERE CARD_STATUS = 1")
        active_cards = cursor.fetchone()["total"]
        cursor.execute(
            """
            SELECT DIVISION_ID, DIVISON_NAME, DIVISION_SHORTNAME, STATUS
            FROM master_divisions
            ORDER BY DIVISON_NAME
            """
        )
        divisions = cursor.fetchall()
        return jsonify({
            "posters": posters,
            "campaigns": campaigns,
            "active_cards": active_cards,
            "divisions": divisions,
        })
    finally:
        cursor.close()
        connection.close()


@app.get("/api/analytics")
def analytics_data():
    connection = mysql.connector.connect(**DB_CONFIG)
    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT COALESCE(CAST(GEN_POSTER_STATUS AS CHAR), 'Unmarked') AS label, COUNT(*) AS total
            FROM generated_poster
            GROUP BY GEN_POSTER_STATUS
            ORDER BY total DESC
        """)
        status = cursor.fetchall()

        cursor.execute("""
            SELECT COALESCE(NULLIF(TRIM(CARD_TYPE), ''), 'Not specified') AS label, COUNT(*) AS total
            FROM generated_poster
            GROUP BY label
            ORDER BY total DESC
            LIMIT 12
        """)
        card_types = cursor.fetchall()

        cursor.execute("""
            SELECT DATE_FORMAT(GEN_POSTER_CREATED_TS, '%Y-%m') AS label, COUNT(*) AS total
            FROM generated_poster
            GROUP BY label
            ORDER BY label
        """)
        monthly_output = cursor.fetchall()

        cursor.execute("""
            SELECT COALESCE(NULLIF(TRIM(EMPLOYEE_NAME), ''), 'Unassigned') AS label, COUNT(*) AS total
            FROM generated_poster
            GROUP BY label
            ORDER BY total DESC
            LIMIT 12
        """)
        employee_output = cursor.fetchall()

        cursor.execute("""
            SELECT 'Generated posters' AS label, COUNT(*) AS total FROM generated_poster
            UNION ALL SELECT 'Men''s Day posters', COUNT(*) FROM mensday_generated_posters
            UNION ALL SELECT 'Ultra Bandhan posters', COUNT(*) FROM ultra_bhandhan_generated_poster
            UNION ALL SELECT 'EcoGold cards', COUNT(*) FROM ecogold_cards
            UNION ALL SELECT 'Flashcard entries', COUNT(*) FROM flashcard_entries
        """)
        sources = cursor.fetchall()

        cursor.execute("""
            SELECT COALESCE(NULLIF(TRIM(DOCTOR_SPECIALITY), ''), 'Not specified') AS label, COUNT(*) AS total
            FROM generated_poster
            GROUP BY label
            ORDER BY total DESC
            LIMIT 12
        """)
        specialties = cursor.fetchall()

        cursor.execute("""
            SELECT COALESCE(NULLIF(TRIM(service_name), ''), 'Not specified') AS label, COUNT(*) AS total
            FROM doctor_services_interested
            GROUP BY label
            ORDER BY total DESC
            LIMIT 12
        """)
        services = cursor.fetchall()

        cursor.execute("""
            SELECT 'Doctor image profiles' AS label, COUNT(*) AS total FROM doctor_images
            UNION ALL SELECT 'Service interests', COUNT(*) FROM doctor_services_interested
            UNION ALL SELECT 'Generated poster doctors', COUNT(DISTINCT NULLIF(TRIM(DOCTOR_NAME), '')) FROM generated_poster
            UNION ALL SELECT 'Doctors with speciality', COUNT(*) FROM generated_poster WHERE NULLIF(TRIM(DOCTOR_SPECIALITY), '') IS NOT NULL
        """)
        audience_summary = cursor.fetchall()

        cursor.execute("""
            SELECT mc.CAMPAIGN_ID, mc.CAMPAIGN_NAME, mc.DIVISION_ID, mc.STATUS,
                   mc.CARD_FROM_DATE, mc.CARD_TO_DATE,
                   COUNT(DISTINCT cl.CARD_ID) AS cards,
                   SUM(CASE WHEN cl.CARD_STATUS = 1 THEN 1 ELSE 0 END) AS active_cards,
                   COUNT(DISTINCT ff.id) AS field_configs
            FROM master_campaigns mc
            LEFT JOIN cardlist cl ON cl.CAMPAIGN_ID = mc.CAMPAIGN_ID
            LEFT JOIN form_fields ff ON ff.CARD_ID = cl.CARD_ID
            GROUP BY mc.CAMPAIGN_ID, mc.CAMPAIGN_NAME, mc.DIVISION_ID, mc.STATUS,
                     mc.CARD_FROM_DATE, mc.CARD_TO_DATE
            ORDER BY mc.CREATEDON DESC
        """)
        catalog = cursor.fetchall()

        cursor.execute("""
            SELECT 'Campaigns' AS label, COUNT(*) AS total FROM master_campaigns
            UNION ALL SELECT 'Active campaigns', COUNT(*) FROM master_campaigns WHERE STATUS = 1001
            UNION ALL SELECT 'Cards', COUNT(*) FROM cardlist
            UNION ALL SELECT 'Active cards', COUNT(*) FROM cardlist WHERE CARD_STATUS = 1
            UNION ALL SELECT 'Form configurations', COUNT(*) FROM form_fields
        """)
        catalog_summary = cursor.fetchall()

        def normalize(rows):
            return [{key: json_value(value) for key, value in row.items()} for row in rows]

        return jsonify({
            "operations": {
                "status": normalize(status),
                "card_types": normalize(card_types),
                "monthly_output": normalize(monthly_output),
                "employee_output": normalize(employee_output),
                "sources": normalize(sources),
            },
            "audience": {
                "specialties": normalize(specialties),
                "services": normalize(services),
                "summary": normalize(audience_summary),
            },
            "catalog": {
                "summary": normalize(catalog_summary),
                "campaigns": normalize(catalog),
            },
        })
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)