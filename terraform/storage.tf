# S3 Bucket for logs and backups
resource "aws_s3_bucket" "logs" {
  bucket = "syntera-logs-${var.environment}-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "syntera-logs-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "logs" {
  bucket = aws_s3_bucket.logs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    filter {
      prefix = ""
    }

    expiration {
      days = 30
    }
  }
}

# S3 Bucket for Terraform state (created manually first)
# This is referenced in backend config
resource "aws_s3_bucket" "terraform_state" {
  count  = var.create_state_bucket ? 1 : 0
  bucket = "syntera-terraform-state-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name = "syntera-terraform-state"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  count  = var.create_state_bucket ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  count  = var.create_state_bucket ? 1 : 0
  bucket = aws_s3_bucket.terraform_state[0].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

data "aws_caller_identity" "current" {}

