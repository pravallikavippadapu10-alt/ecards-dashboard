import csv
import argparse
import os
from pathlib import Path

import mysql.connector


DB_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
DB_PORT = int(os.getenv("MYSQL_PORT", "3306"))
DB_USER = os.getenv("MYSQL_USER", "root")
DB_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
DB_NAME = os.getenv("MYSQL_DATABASE", "")
TABLE_NAME = os.getenv("MYSQL_TABLE", "")
OUTPUT_FILE = Path(os.getenv("MYSQL_OUTPUT", "mysql_export.csv"))


def export_table(database: str, table: str, output_file: Path) -> None:
	connection = mysql.connector.connect(
		host=DB_HOST,
		port=DB_PORT,
		user=DB_USER,
		password=DB_PASSWORD,
		database=database,
	)

	try:
		cursor = connection.cursor(dictionary=True)
		cursor.execute(f"SELECT * FROM `{table}`")
		rows = cursor.fetchall()

		if not rows:
			print("The table contains no rows.")
			return

		with output_file.open("w", newline="", encoding="utf-8") as csv_file:
			writer = csv.DictWriter(csv_file, fieldnames=rows[0].keys())
			writer.writeheader()
			writer.writerows(rows)

		print(f"Exported {len(rows)} rows to {output_file.resolve()}")
	finally:
		cursor.close()
		connection.close()


if __name__ == "__main__":
	parser = argparse.ArgumentParser(description="Export a MySQL table to CSV.")
	parser.add_argument("--database", default=DB_NAME, required=not DB_NAME)
	parser.add_argument("--table", default=TABLE_NAME, required=not TABLE_NAME)
	parser.add_argument("--output", type=Path, default=OUTPUT_FILE)
	args = parser.parse_args()
	export_table(args.database, args.table, args.output)
