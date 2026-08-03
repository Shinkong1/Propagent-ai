# RDS PostgreSQL
resource "aws_db_subnet_group" "main" {
  name       = "${local.name}-db-subnet"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "postgres" {
  identifier              = "${local.name}-postgres"
  engine                  = "postgres"
  engine_version          = "15.4"
  instance_class          = "db.t3.small"
  allocated_storage       = 20
  max_allocated_storage   = 100
  db_name                 = "propagent"
  username                = "propagent"
  password                = var.db_password
  db_subnet_group_name    = aws_db_subnet_group.main.name
  skip_final_snapshot     = false
  final_snapshot_identifier = "${local.name}-final-snapshot"
  backup_retention_period = 7
  deletion_protection     = true
  tags                    = local.tags
}

output "db_endpoint" { value = aws_db_instance.postgres.endpoint }
