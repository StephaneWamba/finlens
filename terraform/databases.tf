# MongoDB (DocumentDB)
resource "aws_docdb_cluster" "main" {
  count                           = var.infrastructure_active ? 1 : 0
  cluster_identifier              = "syntera-mongodb-${var.environment}"
  engine                          = "docdb"
  engine_version                  = "5.0.0"
  master_username                 = var.mongodb_username
  master_password                 = var.mongodb_password
  db_subnet_group_name            = aws_docdb_subnet_group.main[0].name
  vpc_security_group_ids          = [aws_security_group.mongodb.id]
  backup_retention_period         = 7
  preferred_backup_window         = "03:00-04:00"
  skip_final_snapshot             = var.environment == "dev" ? true : false
  final_snapshot_identifier       = var.environment == "dev" ? null : "syntera-mongodb-final-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  enabled_cloudwatch_logs_exports = ["audit", "profiler"]
  storage_encrypted               = true

  tags = {
    Name = "syntera-mongodb-${var.environment}"
  }
}

resource "aws_docdb_cluster_instance" "main" {
  count              = var.infrastructure_active ? 1 : 0
  identifier         = "syntera-mongodb-instance-${count.index + 1}-${var.environment}"
  cluster_identifier = aws_docdb_cluster.main[0].id
  instance_class     = var.mongodb_instance_class
  engine             = "docdb"
}

resource "aws_docdb_subnet_group" "main" {
  count      = var.infrastructure_active ? 1 : 0
  name       = "syntera-mongodb-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "syntera-mongodb-subnet-${var.environment}"
  }
}

# Redis (ElastiCache)
resource "aws_elasticache_subnet_group" "redis" {
  count      = var.infrastructure_active ? 1 : 0
  name       = "syntera-redis-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "redis" {
  count                      = var.infrastructure_active ? 1 : 0
  replication_group_id       = "syntera-redis-${var.environment}"
  description                = "Redis cluster for Syntera"
  node_type                  = var.redis_node_type
  port                       = 6379
  parameter_group_name       = "default.redis7"
  num_cache_clusters         = 1
  automatic_failover_enabled = false
  subnet_group_name          = aws_elasticache_subnet_group.redis[0].name
  security_group_ids         = [aws_security_group.redis.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  tags = {
    Name = "syntera-redis-${var.environment}"
  }
}

# RabbitMQ (Amazon MQ)
resource "aws_mq_broker" "rabbitmq" {
  count                      = var.infrastructure_active ? 1 : 0
  broker_name                = "syntera-rabbitmq-${var.environment}"
  engine_type                = "RabbitMQ"
  engine_version             = "3.13"
  host_instance_type         = var.rabbitmq_instance_type
  auto_minor_version_upgrade = true
  security_groups            = [aws_security_group.rabbitmq.id]
  subnet_ids                 = [aws_subnet.private[0].id]

  user {
    username = var.rabbitmq_username
    password = var.rabbitmq_password
  }

  logs {
    general = true
  }

  tags = {
    Name = "syntera-rabbitmq-${var.environment}"
  }
}

