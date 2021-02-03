FROM public.ecr.aws/lambda/python:3.7

# Setup and install dependencies
COPY requirements.txt /var/task/
RUN pip install -r requirements.txt

# Install pulumi
RUN curl -fsSL https://get.pulumi.com | sh
RUN mv /root/.pulumi /opt/pulumi

# Add to PATH
ENV PATH="/opt/pulumi/bin:${PATH}"

# Create a pulumi home directory
RUN mkdir /tmp/pulumi_home
ENV PULUMI_HOME=/tmp/pulumi_home

# Copy program to /var/task
COPY main.py /var/task

CMD ["main.handler"]
